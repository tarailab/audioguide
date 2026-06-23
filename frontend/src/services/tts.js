let voicesCache = [];
let unlocked = false;

// Sequential-chunk playback state. Mobile Chrome silently cuts off any single
// utterance after ~10–15s, and the desktop pause()/resume() keep-alive trick
// actually STOPS speech on Android. So instead we split the story into short
// chunks and speak them back-to-back — each is well under the limit.
let chunks = [];
let chunkIdx = 0;
let onDone = null;
let active = false;
let curLang = 'en';

function loadVoices() {
  if (!window.speechSynthesis) return;
  const v = window.speechSynthesis.getVoices();
  if (v && v.length) voicesCache = v;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Call from inside a user gesture (tap) to unlock audio on Android/iOS Chrome.
export function primeTTS() {
  if (unlocked || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    unlocked = true;
    loadVoices();
  } catch { /* ignore */ }
}

// Split into chunks that end on sentence boundaries, each ≤ ~160 chars so no
// single utterance is long enough to trigger the mobile cutoff.
function splitText(text, max = 160) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  const out = [];
  let buf = '';
  for (const s of sentences) {
    if (buf && (buf.length + s.length) > max) { out.push(buf.trim()); buf = s; }
    else buf += s;
    // A single very long sentence: hard-split on commas / spaces.
    while (buf.length > max) {
      let cut = buf.lastIndexOf(',', max);
      if (cut < max * 0.5) cut = buf.lastIndexOf(' ', max);
      if (cut <= 0) cut = max;
      out.push(buf.slice(0, cut + 1).trim());
      buf = buf.slice(cut + 1);
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function pickVoice(language) {
  if (!voicesCache.length) loadVoices();
  const want = language === 'lt' ? 'lt' : 'en';
  return (
    voicesCache.find(v => v.lang?.toLowerCase().startsWith(want) && v.localService) ||
    voicesCache.find(v => v.lang?.toLowerCase().startsWith(want)) ||
    voicesCache[0]
  );
}

function speakNext() {
  if (!active) return;
  if (chunkIdx >= chunks.length) {
    active = false;
    const cb = onDone; onDone = null;
    cb?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(chunks[chunkIdx]);
  u.lang = curLang === 'lt' ? 'lt-LT' : 'en-US';
  u.rate = 0.92;
  u.pitch = 1.0;
  u.volume = 1.0;
  const voice = pickVoice(curLang);
  if (voice) u.voice = voice;

  u.onend = () => { if (!active) return; chunkIdx++; speakNext(); };
  u.onerror = (e) => {
    if (!active) return;
    console.warn('[TTS] chunk error', e.error);
    chunkIdx++;
    speakNext();          // skip the bad chunk, keep going
  };
  window.speechSynthesis.speak(u);
}

export function speak(text, language = 'en', onEnd) {
  stop();
  if (!window.speechSynthesis) { onEnd?.(); return; }

  chunks = splitText(text);
  chunkIdx = 0;
  onDone = onEnd;
  curLang = language;
  active = true;
  speakNext();
}

export function stop() {
  active = false;
  chunks = [];
  chunkIdx = 0;
  onDone = null;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

export function pause() {
  window.speechSynthesis?.pause();
}

export function resume() {
  // On some Android builds resume() needs a nudge.
  window.speechSynthesis?.resume();
}
