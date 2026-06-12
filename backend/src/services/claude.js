const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LENGTH_WORDS = { '30s': 70, '1min': 150, '3min': 450, '5min': 750 };

async function generateStory({ poi, context, interests, tone, length, language, bearing }) {
  const wordCount = LENGTH_WORDS[length] || 150;
  const langName = language === 'lt' ? 'Lithuanian' : 'English';
  const toneDesc = tone === 'storyteller'
    ? 'vivid, dramatic, narrative — like a campfire story'
    : tone === 'scholarly'
    ? 'factual, precise, informative — like a knowledgeable guide'
    : 'friendly, conversational, warm — like a well-travelled friend';

  const system = `You are a travel storyteller for an audio guide app. The listener is in a moving vehicle or walking.

Rules:
- Write a vivid narrative, not a list of facts
- Open with a hook — never start with "Welcome to" or "Today we visit"
- Mention the direction once, naturally: "${bearing}"
- Target: approximately ${wordCount} words (this will be spoken aloud at ~150 words/minute)
- Tone: ${toneDesc}
- Write entirely in ${langName}
- End naturally — no "thank you for listening" or "I hope you enjoyed"`;

  const user = `Tell a story about: ${poi.name}

Facts: ${context}

Listener's interests: ${interests.join(', ')}`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: Math.ceil(wordCount * 2.5),
    system,
    messages: [{ role: 'user', content: user }],
  });

  return msg.content[0].text;
}

module.exports = { generateStory };
