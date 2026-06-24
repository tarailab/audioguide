// "Natural" engine: MP3 from our backend (local Piper TTS), played via an
// <audio> element — real media, so it routes through Android Auto and plays to
// the end. See tts.js for the engine selector.

const BASE = import.meta.env.VITE_API_URL || '';
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

let audio = null;
let finishCb = null;
let token = 0;
let unlocked = false;
let curUrl = null;

function ensureAudio() {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleEnded);
  }
  return audio;
}

function handleEnded() {
  const cb = finishCb;
  finishCb = null;
  cb?.();
}

function revoke() {
  if (curUrl) { try { URL.revokeObjectURL(curUrl); } catch { /* ignore */ } curUrl = null; }
}

export function primeTTS() {
  if (unlocked) return;
  const a = ensureAudio();
  try {
    a.src = SILENT;
    a.play().then(() => { a.pause(); a.currentTime = 0; unlocked = true; }).catch(() => {});
  } catch { /* ignore */ }
}

function setMediaSession(title) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: title || 'Audioguide',
      artist: 'AI Audioguide',
    });
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('play', () => resume());
  } catch { /* ignore */ }
}

export async function speak(text, language = 'en', onEnd, title) {
  stop();
  const my = token;
  finishCb = onEnd;
  const a = ensureAudio();

  try {
    const res = await fetch(`${BASE}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });
    if (my !== token) return;
    if (!res.ok) throw new Error(`tts ${res.status}`);

    const blob = await res.blob();
    if (my !== token) return;

    revoke();
    curUrl = URL.createObjectURL(blob);
    a.src = curUrl;
    await a.play();
    setMediaSession(title);
  } catch (err) {
    if (my !== token) return;
    console.error('[TTS:server] playback failed:', err.message);
    const cb = finishCb; finishCb = null;
    cb?.();
  }
}

export function stop() {
  token++;
  finishCb = null;
  if (audio) {
    try { audio.pause(); } catch { /* ignore */ }
    audio.removeAttribute('src');
  }
  revoke();
}

export function pause() {
  try { audio?.pause(); } catch { /* ignore */ }
}

export function resume() {
  audio?.play().catch(() => {});
}
