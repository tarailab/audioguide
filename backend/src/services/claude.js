const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LENGTH_WORDS = { '30s': 70, '1min': 150, '3min': 450, '5min': 750 };

// Pull useful facts out of OSM tags
function extractOsmFacts(tags = {}) {
  const facts = [];
  if (tags.population)   facts.push(`population: ${tags.population}`);
  if (tags.start_date)   facts.push(`established: ${tags.start_date}`);
  if (tags.opening_date) facts.push(`opened: ${tags.opening_date}`);
  if (tags.height)       facts.push(`height: ${tags.height}m`);
  if (tags.ele)          facts.push(`elevation: ${tags.ele}m`);
  if (tags.architect)    facts.push(`architect: ${tags.architect}`);
  if (tags.operator)     facts.push(`operator: ${tags.operator}`);
  if (tags.description)  facts.push(`description: ${tags.description}`);
  if (tags['name:etymology:wikipedia']) facts.push(`named after: ${tags['name:etymology:wikipedia']}`);
  return facts;
}

function deriveTone(tags, hasRichContext, userTone) {
  const type = tags.historic || tags.tourism || tags.natural || tags.place || tags.building || '';

  if (['bridge', 'industrial', 'power_station', 'water_tower', 'dam'].some(t => type.includes(t)))
    return 'informative and precise — explain what it is, how it was built, one surprising engineering fact';
  if (['memorial', 'monument'].includes(type) && hasRichContext)
    return 'reflective and moving — let the facts speak, avoid melodrama';
  if (!hasRichContext)
    return 'casual and factual — like a knowledgeable friend who is honest about what they do and don\'t know';

  const toneMap = {
    storyteller: 'vivid, dramatic, narrative — like a campfire story',
    scholarly:   'factual, precise, informative — like a knowledgeable guide',
    friend:      'friendly, conversational — like a well-travelled friend',
  };
  return toneMap[userTone] || toneMap.storyteller;
}

async function generateStory({ poi, context, interests, tone, length, language, bearing, wdFacts = [] }) {
  const wordCount = LENGTH_WORDS[length] || 150;
  const langName = language === 'lt' ? 'Lithuanian' : 'English';
  const tags = poi.tags || {};
  const hasRichContext = context && context.length > 100 && !context.includes('— a notable place');
  const toneDesc = deriveTone(tags, hasRichContext, tone);
  const osmFacts = extractOsmFacts(tags);
  const etymology = tags['name:etymology'];

  // Prefer the listener's-language name when the place has one.
  const displayName = (language === 'lt' ? tags['name:lt'] : tags['name:en']) || poi.name;
  const poiType = tags.historic || tags.tourism || tags.natural || tags.man_made || tags.place || tags.building || 'place';

  const contextBlock = [
    hasRichContext ? `Wikipedia/web: ${context}` : null,
    wdFacts.length ? `Verified facts (Wikidata): ${wdFacts.join(', ')}` : null,
    osmFacts.length ? `OSM data: ${osmFacts.join(', ')}` : null,
    etymology ? `Named after / etymology: ${etymology}` : null,
  ].filter(Boolean).join('\n') || 'No additional context found.';

  const system = `You are an audio guide for travellers. The listener is in a moving vehicle or walking nearby.

Rules:
- Speak naturally — this will be read aloud
- Open with a hook, never "Welcome to" or "Today we visit"
- Mention direction once, naturally: "${bearing}"
- Target: ~${wordCount} words (~${Math.round(wordCount / 150)} min at speaking pace)
- Tone: ${toneDesc}
- Language: ${langName} only
- No sign-off phrases

STRICT honesty rules:
- Only state facts you actually have. Do NOT invent history, legends, events, or people.
- If context is thin: give the hard facts you DO have (type, size, age, population if known), then stop.
- Do NOT speculate on name etymology. BUT if an etymology is given in the context below, it is verified — you may use it as a hook.
- If verified facts are provided, prefer them; weave concrete numbers/dates in naturally.
- If there is genuinely nothing notable to say, say so plainly in 2-3 sentences: what it is, roughly when/why it exists, and move on. That is better than padding with vague atmosphere.`;

  const user = `Place: ${displayName}
Type: ${poiType}
${contextBlock}
Listener interests: ${interests.length ? interests.join(', ') : 'general'}`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: Math.ceil(wordCount * 2.5),
    system,
    messages: [{ role: 'user', content: user }],
  });

  return msg.content[0].text;
}

module.exports = { generateStory };
