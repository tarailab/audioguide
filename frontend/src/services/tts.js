let voicesCache = [];
let unlocked = false;
let keepAlive = null;

function loadVoices() {
  if (!window.speechSynthesis) return;
  const v = window.speechSynthesis.getVoices();
  if (v && v.length) voicesCache = v;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Must be called from inside a user gesture (a tap/click) to unlock audio
// playback on Android/iOS Chrome. Idempotent — safe to call on every tap.
export function primeTTS() {
  if (unlocked || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; // silent priming utterance
    window.speechSynthesis.speak(u);
    unlocked = true;
    loadVoices();
  } catch { /* ignore */ }
}

// Mobile Chrome stops speaking after ~15s of a long utterance. Nudging
// pause()/resume() periodically keeps it alive without an audible gap.
function startKeepAlive() {
  stopKeepAlive();
  keepAlive = setInterval(() => {
    const s = window.speechSynthesis;
    if (s && s.speaking && !s.paused) {
      s.pause();
      s.resume();
    }
  }, 10000);
}

function stopKeepAlive() {
  if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
}

export function speak(text, language = 'en', onEnd) {
  stop();

  if (!window.speechSynthesis) {
    console.warn('TTS not available');
    onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'lt' ? 'lt-LT' : 'en-US';
  utterance.rate = 0.88;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  if (!voicesCache.length) loadVoices();
  const want = language === 'lt' ? 'lt' : 'en';
  const voice =
    voicesCache.find(v => v.lang?.toLowerCase().startsWith(want) && v.localService) ||
    voicesCache.find(v => v.lang?.toLowerCase().startsWith(want)) ||
    voicesCache[0];
  if (voice) utterance.voice = voice;

  utterance.onend = () => { stopKeepAlive(); onEnd?.(); };
  utterance.onerror = (e) => {
    console.warn('[TTS] error', e.error);
    stopKeepAlive();
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
  startKeepAlive();
}

export function stop() {
  stopKeepAlive();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

export function pause() {
  window.speechSynthesis?.pause();
}

export function resume() {
  window.speechSynthesis?.resume();
}
