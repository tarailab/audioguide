import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchPOIs, fetchStory } from '../services/api';
import { speak, stop, pause, resume } from '../services/tts';

const DENSITY_GAP_S = { sparse: 1200, normal: 480, rich: 180 };
const FORWARD_ARC_DEG = 100; // ±100° of travel direction counts as "ahead"

function haversine(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Compass bearing (deg from N) from point a to point b.
function bearing(a, b) {
  const toRad = d => d * Math.PI / 180;
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Smallest angle between two compass bearings (0–180°).
function angleBetween(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Re-discover after moving roughly this far (scales with speed). The search
// radius itself is computed by the backend now.
function rediscoverThresholdM(speedKmh) {
  return Math.min(1500, Math.max(200, Math.round(200 + (speedKmh || 0) * 8)));
}

// How close a place must be before we start its story, scaled by speed so a
// story has time to play before you reach the place. Generous at speed because
// on a rural highway notable places (hillforts, churches) sit a few km off the
// road and you still want to hear about them as you pass.
function triggerDistanceM(speedKmh) {
  return Math.min(4000, Math.max(200, Math.round(200 + (speedKmh || 0) * 30)));
}

const DROP_MS = 90000; // keep a place this long after it leaves the search set, then drop

// Merge fresh discovery results into the queue. Places the backend still
// returns are refreshed (lastSeen = now). Places it stopped returning linger
// and fade until DROP_MS passes, then drop. Played places are removed.
function mergeQueue(prev, places, visited) {
  const now = Date.now();
  const fresh = new Map(places.filter(p => !visited.has(p.id)).map(p => [p.id, p]));
  const seen = new Set();
  const out = [];
  prev.forEach(old => {
    if (visited.has(old.id)) return;
    seen.add(old.id);
    const np = fresh.get(old.id);
    if (np) out.push({ ...np, lastSeen: now });
    else if (now - (old.lastSeen ?? now) <= DROP_MS) out.push(old); // fading, keep
  });
  fresh.forEach((np, id) => { if (!seen.has(id)) out.push({ ...np, lastSeen: now }); });
  return out.sort((a, b) => a.distance - b.distance);
}

export function useStoryQueue({ position, heading, mode, speedKmh = 0, course, prefs, autoMode = true, searchParams = null }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | fetching | loading | playing | paused
  const [reactions, setReactions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('audioguide-reactions') || '[]'); } catch { return []; }
  });
  const [area, setArea] = useState(null); // current search-area params (for admin overlay)

  const visitedIds = useRef(new Set());
  const lastFetchPos = useRef(null);
  const lastFetchAt = useRef(0);
  const lastStoryAt = useRef(0);
  const busy = useRef(false);
  const discovering = useRef(false);
  // Bumped every time we start/stop a story. A story's async callbacks only
  // apply if their token is still current — this stops a cancelled story's
  // onEnd from wiping out the story that replaced it.
  const playToken = useRef(0);

  // Background POI discovery — runs silently, never touches playback status,
  // so it can keep filling the list without interrupting a playing story.
  useEffect(() => {
    if (!position || discovering.current) return;
    // Time throttle: never discover more than once every 8s, no matter how
    // fast position updates arrive.
    if (Date.now() - lastFetchAt.current < 8000) return;
    const moveThreshold = rediscoverThresholdM(speedKmh);
    const moved = !lastFetchPos.current || haversine(position, lastFetchPos.current) > moveThreshold;
    if (!moved) return;
    lastFetchPos.current = position;
    lastFetchAt.current = Date.now();
    discovering.current = true;

    fetchPOIs({ ...position, speedKmh, course, heading, interests: prefs.interests, params: searchParams })
      .then(({ places, area: a }) => {
        setArea(a);
        setQueue(prev => mergeQueue(prev, places, visitedIds.current));
      })
      .catch(err => console.error('[Queue] POI fetch error:', err))
      .finally(() => { discovering.current = false; });
  }, [position]);

  // Auto-play: when idle and close enough to a queued POI, play it.
  // Only ever fires from a clean idle state, so it cannot break a story
  // that is already loading/playing/paused.
  useEffect(() => {
    if (!autoMode) return;
    if (!position || busy.current || status !== 'idle') return;

    const gapOk = (Date.now() - lastStoryAt.current) / 1000 >= (DENSITY_GAP_S[prefs.density] || 480);
    if (!gapOk) return;

    const triggerDist = triggerDistanceM(speedKmh);
    const inRange = queue.filter(p => p.distance <= triggerDist);

    // When actually moving, only auto-play places ahead of us, so we don't
    // narrate something we've already driven past. Standing still → no filter.
    const moving = speedKmh > 8 && Number.isFinite(course);
    const ahead = moving
      ? inRange.filter(p => p.lat && p.lon &&
          angleBetween(course, bearing(position, p)) <= FORWARD_ARC_DEG)
      : inRange;

    const trigger = (ahead.length ? ahead : inRange)[0]; // nearest (queue is distance-sorted)
    if (!trigger) return;

    generateAndPlay(trigger);
  }, [position, queue, status, prefs.density, speedKmh, course, autoMode]);

  // Interrupt-safe: cancels anything in flight, then plays `poi`.
  const generateAndPlay = useCallback(async (poi) => {
    const token = ++playToken.current;
    stop();                       // cancel prior speech (its onEnd is now stale)
    busy.current = true;
    setStatus('loading');
    setCurrent({ poi, text: null });

    try {
      const { story } = await fetchStory({
        poi,
        interests: prefs.interests,
        tone: prefs.tone,
        length: prefs.length,
        language: prefs.language,
        bearing: poi.bearing || 'ahead',
      });

      if (token !== playToken.current) return; // superseded while fetching

      visitedIds.current.add(poi.id);
      setQueue(prev => prev.filter(p => p.id !== poi.id));
      setCurrent({ poi, text: story });
      setStatus('playing');
      lastStoryAt.current = Date.now();

      speak(story, prefs.language, () => {
        if (token !== playToken.current) return; // a newer story took over
        setStatus('idle');
        setCurrent(null);
        busy.current = false;
      }, poi.name, prefs.voiceEngine);
    } catch (err) {
      if (token !== playToken.current) return;
      console.error('[Queue] Story error:', err);
      setStatus('idle');
      setCurrent(null);
      busy.current = false;
    }
  }, [prefs]);

  const togglePause = useCallback(() => {
    if (status === 'playing') {
      pause();
      setStatus('paused');
    } else if (status === 'paused') {
      resume();
      setStatus('playing');
    }
  }, [status]);

  const skip = useCallback(() => {
    playToken.current++;          // invalidate the playing story's onEnd
    stop();
    logReaction('skip');
    setStatus('idle');
    setCurrent(null);
    busy.current = false;
  }, [current]);

  const thumbsUp = useCallback(() => logReaction('up'), [current]);
  const thumbsDown = useCallback(() => logReaction('down'), [current]);

  const logReaction = (action) => {
    if (!current?.poi) return;
    const entry = { poiName: current.poi.name, tags: current.poi.tags, action, ts: Date.now() };
    const updated = [...reactions, entry].slice(-200);
    setReactions(updated);
    localStorage.setItem('audioguide-reactions', JSON.stringify(updated));
  };

  // Manual play always wins — it interrupts whatever is happening.
  const playNow = useCallback(async (specificPoi = null) => {
    if (!position) return;

    if (specificPoi) {
      await generateAndPlay(specificPoi);
      return;
    }

    // No specific POI: play the nearest known one immediately. Only fall back
    // to a fresh search (and the "finding places" spinner) if the list is empty.
    const known = queue.find(p => !visitedIds.current.has(p.id));
    if (known) {
      await generateAndPlay(known);
      return;
    }

    const token = ++playToken.current;
    stop();
    busy.current = true;
    setStatus('fetching');
    let handedOff = false;
    try {
      const { places, area: a } = await fetchPOIs({ ...position, speedKmh, course, heading, interests: prefs.interests, params: searchParams });
      if (token !== playToken.current) return;
      setArea(a);
      const candidates = places.filter(p => !visitedIds.current.has(p.id)).sort((a, b) => a.distance - b.distance);
      setQueue(candidates);
      const next = candidates[0];
      if (!next) return;
      handedOff = true;          // generateAndPlay now owns status/busy
      await generateAndPlay(next);
    } catch (err) {
      console.error('[Queue] playNow error:', err);
    } finally {
      // Never leave the UI stuck on "fetching": if we didn't hand off to a
      // story and nothing newer took over, fall back to idle.
      if (!handedOff && token === playToken.current) {
        setStatus('idle');
        busy.current = false;
      }
    }
  }, [position, heading, course, speedKmh, prefs, queue, generateAndPlay]);

  return { queue, current, status, area, skip, togglePause, thumbsUp, thumbsDown, playNow };
}
