// Proxies text to the local Piper TTS server (OpenAI-compatible API) and
// returns MP3 bytes. Kept behind our own endpoint so the engine can be swapped
// (local Piper now, cloud later) without touching the frontend.

const TTS_URL = process.env.TTS_URL || 'http://tts:8000/v1/audio/speech';

// Map app language → a Piper voice the server knows.
function voiceFor(language) {
  return language === 'lt' ? 'alloy' : 'alloy'; // LT voice TODO; English for now
}

async function synthesize(text, language = 'en') {
  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: voiceFor(language),
      response_format: 'mp3',
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`TTS server ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { synthesize, voiceFor };
