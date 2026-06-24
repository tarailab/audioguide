// TTS engine selector. Two implementations, chosen per-story from preferences:
//   'natural' → ttsServer  (backend MP3 via <audio>, works over Android Auto)
//   'device'  → ttsDevice  (browser Web Speech voice, free/offline)
import * as server from './ttsServer';
import * as device from './ttsDevice';

let activeEngine = server; // whichever engine is currently playing

function engineFor(name) {
  return name === 'device' ? device : server;
}

// Unlock both engines on the first user gesture so either can play later.
export function primeTTS() {
  server.primeTTS();
  device.primeTTS();
}

export function speak(text, language = 'en', onEnd, title, engine = 'natural') {
  // Stop whatever might be playing on either engine, then start the chosen one.
  server.stop();
  device.stop();
  activeEngine = engineFor(engine);
  activeEngine.speak(text, language, onEnd, title);
}

export function stop() {
  server.stop();
  device.stop();
}

export function pause() {
  activeEngine.pause();
}

export function resume() {
  activeEngine.resume();
}
