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

  // Pick a good voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith(language === 'lt' ? 'lt' : 'en') && v.localService
  );
  if (preferred) utterance.voice = preferred;

  if (onEnd) utterance.onend = onEnd;
  utterance.onerror = () => onEnd?.();

  window.speechSynthesis.speak(utterance);
}

export function stop() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

export function pause() {
  window.speechSynthesis?.pause();
}

export function resume() {
  window.speechSynthesis?.resume();
}
