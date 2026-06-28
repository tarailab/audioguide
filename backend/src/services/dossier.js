const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { gatherSources } = require('./research');
const usage = require('./usage');

// Deep-research DOSSIER builder: gather (local-language Wikipedia + refs) →
// extract non-obvious angles/facts/connections with an LLM → trust-scored JSON.
// Demand-gated (called for a POI the user marks "research") and cached per QID so
// a place is NEVER re-extracted — you pay once, ever. Metered via services/usage.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Engine is swappable: default Opus for accuracy; set DOSSIER_MODEL to change.
// A future GLM-5.2 (OpenAI-compatible) swap lives in callLLM() only.
const MODEL = process.env.DOSSIER_MODEL || 'claude-opus-4-8';
const DIR = path.join(__dirname, '../../data/dossiers');

const SYSTEM = `You are a meticulous local historian building a RESEARCH DOSSIER for a place, for a travel app that surfaces the non-obvious "interesting angles" a great local guide would know.

You are given the place's Wikipedia article text in one or more languages (the LOCAL language first). Treat the provided text as a TRUSTED source — extract from it, and do NOT invent facts that aren't supported by it.

Output ONLY a JSON object (no prose, no markdown fences) of this shape:
{
  "summary": "1-2 sentences: what it is and why it's worth visiting",
  "facts": [{"text": "...", "confidence": "high|medium|low", "source": "ca.wikipedia"}],
  "angles": [{"theme": "<crime|war|religion|art|architecture|industry|sport|literature|food|myth|maritime|nature|royalty>", "title": "...", "detail": "...", "confidence": "high|medium|low", "source": "es.wikipedia"}],
  "connections": [{"place": "<other place / person / event>", "relation": "how it links — for narrative routing between POIs"}],
  "needsReview": ["interesting claims that are only thinly supported — keep them HERE rather than dropping or asserting them"],
  "languagesUsed": ["ca", "es"]
}

Rules:
- Prioritize NON-OBVIOUS, specific, story-worthy material over generic encyclopedic summary.
- confidence: "high" if clearly stated in the trusted text; "medium" if implied; "low" → put in needsReview.
- Note which language source each item came from; surface where a local-language article added something the others didn't.
- Do NOT fabricate. If a famous angle isn't in the provided text, put it in needsReview — never assert it.
- Better to under-claim with confidence than over-claim. False facts ruin trust.`;

function corpus(g) {
  const parts = [];
  if (g.description) parts.push(`One-line: ${g.description}`);
  for (const a of g.articles) parts.push(`\n### [${a.lang}] ${a.title}\n${a.text}`);
  if (g.parent) {
    for (const a of g.parent.articles) parts.push(`\n### [county/${a.lang}] ${a.title}\n${a.text}`);
  }
  if (g.refs?.length) parts.push(`\nCited sources (URLs only, not fetched): ${g.refs.slice(0, 30).join(', ')}`);
  return parts.join('\n');
}

function parseJson(text) {
  const cleaned = String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); }
  catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
    return null;
  }
}

// The single LLM seam — swap here for GLM-5.2 / Ollama later.
async function callLLM(system, user) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return { text: msg.content?.[0]?.text || '', usage: msg.usage || {}, model: MODEL };
}

function diskPath(qid) { return path.join(DIR, `${qid}.json`); }

function readCached(qid) {
  try { return JSON.parse(fs.readFileSync(diskPath(qid), 'utf8')); } catch { return null; }
}
function persist(d) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(diskPath(d.qid), JSON.stringify(d, null, 2));
  } catch (err) { console.error('[Dossier] write failed:', err.message); }
}

// Build (or return cached) dossier for a POI. Pass { force: true } to regenerate.
async function buildDossier(poi, { force = false } = {}) {
  const gathered = await gatherSources(poi);
  if (!gathered.qid) return { qid: null, name: poi?.name, error: gathered.note || 'no source' };

  if (!force) {
    const cached = readCached(gathered.qid);
    if (cached) return { ...cached, cached: true };
  }
  if (!gathered.combinedChars) {
    return { qid: gathered.qid, name: gathered.name, error: 'no article text gathered' };
  }

  const { text, usage: u, model } = await callLLM(SYSTEM, corpus(gathered));
  usage.record(model, u, `dossier:${gathered.name}`);

  const parsed = parseJson(text);
  const result = {
    qid: gathered.qid,
    name: gathered.name,
    languages: gathered.languages,
    widened: gathered.widened,
    dossier: parsed,
    parseError: parsed ? null : 'LLM did not return valid JSON',
    sources: gathered.refs,
    model,
    generatedAt: new Date().toISOString(),
  };
  persist(result);
  return result;
}

// SYSTEM/corpus/parseJson exported so the model-comparison harness reuses the
// exact production prompt (fair test — model is the only variable).
module.exports = { buildDossier, SYSTEM, corpus, parseJson, MODEL };
