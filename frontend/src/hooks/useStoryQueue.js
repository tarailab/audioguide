import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchPOIs, fetchStory } from '../services/api';
import { speak, stop } from '../services/tts';

const DENSITY_GAP_S = { sparse: 1200, normal: 480, rich: 180 };
const TRIGGER_DIST_M = { car: 800, walk: 150 };
const MIN_MOVE_M = 300;

function haversine(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useStoryQueue({ position, heading, mode, prefs }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | fetching | loading | playing
  const [reactions, setReactions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('audioguide-reactions') || '[]'); } catch { return []; }
  });

  const visitedIds = useRef(new Set());
  const lastFetchPos = useRef(null);
  const lastStoryAt = useRef(0);
  const busy = useRef(false);

  // Re-fetch POIs when we've moved enough
  useEffect(() => {
    if (!position || status === 'playing') return;
    const moved = !lastFetchPos.current || haversine(position, lastFetchPos.current) > MIN_MOVE_M;
    if (!moved) return;
    lastFetchPos.current = position;

    const radius = mode === 'car' ? 12000 : 600;
    setStatus(s => s === 'idle' ? 'fetching' : s);

    fetchPOIs({ ...position, heading, interests: prefs.interests, radius })
      .then(pois => {
        const fresh = pois.filter(p => !visitedIds.current.has(p.id));
        setQueue(prev => {
          const existing = new Set(prev.map(p => p.id));
          const toAdd = fresh.filter(p => !existing.has(p.id));
          return [...prev, ...toAdd].sort((a, b) => a.distance - b.distance);
        });
      })
      .catch(err => console.error('[Queue] POI fetch error:', err))
      .finally(() => setStatus(s => s === 'fetching' ? 'idle' : s));
  }, [position, mode]);

  // Trigger story playback when close enough to queued POI
  useEffect(() => {
    if (!position || busy.current || status === 'playing' || status === 'loading') return;

    const gapOk = (Date.now() - lastStoryAt.current) / 1000 >= (DENSITY_GAP_S[prefs.density] || 480);
    if (!gapOk) return;

    const triggerDist = TRIGGER_DIST_M[mode] || 200;
    const trigger = queue.find(p => p.distance <= triggerDist);
    if (!trigger) return;

    generateAndPlay(trigger);
  }, [position, queue, status, prefs.density, mode]);

  const generateAndPlay = useCallback(async (poi) => {
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

      visitedIds.current.add(poi.id);
      setQueue(prev => prev.filter(p => p.id !== poi.id));
      setCurrent({ poi, text: story });
      setStatus('playing');
      lastStoryAt.current = Date.now();

      speak(story, prefs.language, () => {
        setStatus('idle');
        setCurrent(null);
        busy.current = false;
      });
    } catch (err) {
      console.error('[Queue] Story error:', err);
      setStatus('idle');
      setCurrent(null);
      busy.current = false;
    }
  }, [prefs]);

  const skip = useCallback(() => {
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

  const playNow = useCallback(async () => {
    if (busy.current || !position) return;
    setStatus('fetching');
    try {
      const pois = await fetchPOIs({ ...position, heading, interests: prefs.interests, radius: 2000 });
      const fresh = pois.filter(p => !visitedIds.current.has(p.id));
      if (fresh.length === 0) { setStatus('idle'); return; }
      setQueue(fresh);
      await generateAndPlay(fresh[0]);
    } catch (err) {
      console.error('[Queue] playNow error:', err);
      setStatus('idle');
    }
  }, [position, heading, prefs, generateAndPlay]);

  return { queue, current, status, skip, thumbsUp, thumbsDown, playNow };
}
