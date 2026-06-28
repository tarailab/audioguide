// Model comparison for dossier extraction (backlog B2). For each place: gather
// ONCE, then feed the IDENTICAL corpus + production SYSTEM prompt to every model
// — so the model is the only variable. Engines: Opus, Sonnet, GLM (if keyed),
// local gemma via Ollama. Run inside the backend container:
//   docker exec audioguide-backend-1 node src/scripts/compare-models.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { gatherSources } = require('../services/research');
const { SYSTEM, corpus, parseJson } = require('../services/dossier');
const usage = require('../services/usage');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PLACES = ['Comillas', 'Hondarribia', 'Mondoñedo', 'Estella-Lizarra', 'Cadaqués'];

const ENGINES = [
  { id: 'opus', provider: 'anthropic', model: 'claude-opus-4-8' },
  { id: 'sonnet', provider: 'anthropic', model: 'claude-sonnet-4-6' },
];
if (process.env.GLM_API_KEY) {
  ENGINES.push({
    id: 'glm', provider: 'openai',
    model: process.env.GLM_MODEL || 'glm-4.6',
    baseUrl: (process.env.GLM_BASE_URL || 'https://api.z.ai/api/paas/v4').replace(/\/$/, ''),
    apiKey: process.env.GLM_API_KEY,
  });
}
const OLLAMA = (process.env.OLLAMA_URL || 'http://host.docker.internal:11434').replace(/\/$/, '');
ENGINES.push({
  id: 'gemma', provider: 'openai',
  model: process.env.LOCAL_MODEL || 'gemma4:26b-a4b-it-qat',
  baseUrl: `${OLLAMA}/v1`, apiKey: 'ollama',
});

async function callAnthropic(model, system, user) {
  const t = Date.now();
  const m = await anthropic.messages.create({ model, max_tokens: 4000, system, messages: [{ role: 'user', content: user }] });
  return { text: m.content?.[0]?.text || '', usage: m.usage || {}, ms: Date.now() - t };
}

async function callOpenAI(e, system, user) {
  const t = Date.now();
  const res = await fetch(`${e.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${e.apiKey}` },
    body: JSON.stringify({ model: e.model, max_tokens: 4000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(240000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  const d = await res.json();
  return {
    text: d.choices?.[0]?.message?.content || '',
    usage: { input_tokens: d.usage?.prompt_tokens, output_tokens: d.usage?.completion_tokens },
    ms: Date.now() - t,
  };
}

(async () => {
  const OUT = path.join(__dirname, '../../data/model-comparison');
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Engines: ${ENGINES.map((e) => e.id).join(', ')}`);
  const rows = [];

  for (const name of PLACES) {
    const g = await gatherSources({ name, tags: {} });
    if (!g.qid || !g.combinedChars) { console.log(`\n${name}: gather failed (${g.note || 'thin'})`); continue; }
    const user = corpus(g);
    console.log(`\n=== ${name} (${g.qid}, ${g.languages.join('/')}, ${g.combinedChars} chars) ===`);
    for (const e of ENGINES) {
      try {
        const r = e.provider === 'anthropic' ? await callAnthropic(e.model, SYSTEM, user) : await callOpenAI(e, SYSTEM, user);
        if (e.provider === 'anthropic') usage.record(e.model, r.usage, `compare:${name}`);
        const d = parseJson(r.text) || {};
        const ok = !!parseJson(r.text);
        const row = {
          place: name, engine: e.id, model: e.model, ok,
          facts: (d.facts || []).length, angles: (d.angles || []).length,
          conn: (d.connections || []).length, review: (d.needsReview || []).length,
          inTok: r.usage.input_tokens, outTok: r.usage.output_tokens, sec: Math.round(r.ms / 1000),
        };
        rows.push(row);
        console.log(`  ${e.id.padEnd(7)} ok=${ok} facts=${row.facts} angles=${row.angles} conn=${row.conn} review=${row.review} ${row.sec}s (${row.outTok || '?'} out-tok)`);
        fs.writeFileSync(path.join(OUT, `${name}.${e.id}.json`), JSON.stringify({ row, dossier: d, rawHead: r.text.slice(0, 300) }, null, 2));
      } catch (err) {
        console.log(`  ${e.id.padEnd(7)} ERROR ${err.message}`);
        rows.push({ place: name, engine: e.id, error: err.message });
      }
    }
  }

  fs.writeFileSync(path.join(OUT, '_summary.json'), JSON.stringify(rows, null, 2));
  console.log(`\nSaved → data/model-comparison/. Claude spend so far: $${usage.summary().totalUsd.toFixed(2)}`);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
