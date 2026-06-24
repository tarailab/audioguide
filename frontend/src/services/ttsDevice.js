// "Device" engine: the browser's built-in Web Speech voice. Free and offline,
// but Android cuts it off after ~10s over Android Auto (it isn't real media).
// Uses a poll-driven sequencer + wake lock to survive as long as possible.

let voicesCache = [];
let unlocked = false;
let chunks = [];
let chunkIdx = 0;
let finishCb = null;
let active = false;
let userPaused = false;
let curLang = 'en';
let ticker = null;
let lastStart = 0;
let wakeLock = null;

function loadVoices() {
  if (!window.speechSynthesis) return;
  const v = window.speechSynthesis.getVoices();
  if (v && v.length) voicesCache = v;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

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

async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
    }
  } catch { /* ignore */ }
}
function releaseWakeLock() {
  try { wakeLock?.release?.(); } catch { /* ignore */ }
  wakeLock = null;
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && active && !userPaused) {
      acquireWakeLock();
      window.speechSynthesis?.resume();
    }
  });
}

function splitText(text, max = 140) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  const out = [];
  let buf = '';
  for (const s of sentences) {
    if (buf && (buf.length + s.length) > max) { out.push(buf.trim()); buf = s; }
    else buf += s;
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

function speakOne(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = curLang === 'lt' ? 'lt-LT' : 'en-US';
  u.rate = 0.92;
  u.pitch = 1.0;
  u.volume = 1.0;
  const voice = pickVoice(curLang);
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
  lastStart = Date.now();
}

function tick() {
  if (!active || userPaused) return;
  const s = window.speechSynthesis;
  if (!s) return;
  s.resume();
  if (s.speaking || s.pending) return;
  if (Date.now() - lastStart < 700) return;
  if (chunkIdx >= chunks.length) {
    active = false;
    stopTicker();
    releaseWakeLock();
    const cb = finishCb; finishCb = null;
    cb?.();
    return;
  }
  speakOne(chunks[chunkIdx]);
  chunkIdx++;
}

function startTicker() { stopTicker(); ticker = setInterval(tick, 300); }
function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }

export function speak(text, language = 'en', onEnd) {
  stop();
  if (!window.speechSynthesis) { onEnd?.(); return; }
  chunks = splitText(text);
  if (!chunks.length) { onEnd?.(); return; }
  chunkIdx = 0;
  finishCb = onEnd;
  curLang = language;
  userPaused = false;
  active = true;
  lastStart = 0;
  acquireWakeLock();
  speakOne(chunks[chunkIdx]);
  chunkIdx++;
  startTicker();
}

export function stop() {
  active = false;
  userPaused = false;
  chunks = [];
  chunkIdx = 0;
  finishCb = null;
  stopTicker();
  releaseWakeLock();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

export function pause() {
  userPaused = true;
  window.speechSynthesis?.pause();
}

export function resume() {
  userPaused = false;
  window.speechSynthesis?.resume();
}
