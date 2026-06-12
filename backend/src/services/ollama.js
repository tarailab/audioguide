const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const FAST_MODEL = 'qwen3.5:9b';

async function ollamaChat(messages, model = FAST_MODEL) {
  const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 250,
      stream: false,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function filterRelevance(name, tags, interests) {
  if (!interests?.length) return 8;
  const tagStr = Object.entries(tags || {})
    .filter(([k]) => k !== 'name')
    .map(([k, v]) => `${k}=${v}`)
    .slice(0, 6)
    .join(', ');

  const prompt = `Rate the relevance of this POI to the user's interests. Reply with ONLY a number 0-10, nothing else.

POI: "${name}"
Tags: ${tagStr}
User interests: ${interests.join(', ')}`;

  const reply = await ollamaChat([{ role: 'user', content: prompt }]);
  const score = parseInt(reply.match(/\d+/)?.[0] ?? '5', 10);
  return Math.min(10, Math.max(0, score));
}

async function condenseSummary(text, interests) {
  const prompt = `Summarize in 80-100 words. Focus on: historical significance, interesting stories, notable events relevant to [${interests.join(', ')}]. Skip tourism/practical info, opening hours, and ticket prices.

Text: ${text.slice(0, 3000)}

Summary:`;

  return await ollamaChat([{ role: 'user', content: prompt }]);
}

async function testOllama() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = { filterRelevance, condenseSummary, testOllama };
