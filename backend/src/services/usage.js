const fs = require('fs');
const path = require('path');

// Claude API cost meter for the research/dossier track. Records token usage per
// call, accumulates a persistent running total, and raises a one-time alert when
// cumulative spend crosses a budget threshold (default $5 — Mindaugas asked to be
// told when it goes over ~$5; raise RESEARCH_BUDGET_ALERT_USD to bump it).
const DIR = path.join(__dirname, '../../data');
const FILE = path.join(DIR, 'research-usage.json');
const ALERT_USD = Number(process.env.RESEARCH_BUDGET_ALERT_USD || 5);

// $ per token (input / output / cache-write 1.25x / cache-read 0.1x). Keep in
// sync with the Claude API pricing table.
const PRICING = {
  'claude-opus-4-8':   { in: 5 / 1e6, out: 25 / 1e6, cw: 6.25 / 1e6, cr: 0.5 / 1e6 },
  'claude-sonnet-4-6': { in: 3 / 1e6, out: 15 / 1e6, cw: 3.75 / 1e6, cr: 0.3 / 1e6 },
  'claude-haiku-4-5':  { in: 1 / 1e6, out: 5 / 1e6,  cw: 1.25 / 1e6, cr: 0.1 / 1e6 },
};
function rate(model) {
  return PRICING[model] || PRICING[Object.keys(PRICING).find((k) => model?.startsWith(k))] || PRICING['claude-opus-4-8'];
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { totalUsd: 0, calls: 0, inputTokens: 0, outputTokens: 0, byModel: {}, since: new Date().toISOString(), alertedAtUsd: 0 };
  }
}

function persist(state) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(state, null, 2));
    fs.renameSync(`${FILE}.tmp`, FILE);
  } catch (err) {
    console.error('[Usage] write failed:', err.message);
  }
}

function costOf(model, u = {}) {
  const r = rate(model);
  return (u.input_tokens || 0) * r.in
    + (u.output_tokens || 0) * r.out
    + (u.cache_creation_input_tokens || 0) * r.cw
    + (u.cache_read_input_tokens || 0) * r.cr;
}

// Record one Claude call. Returns { callUsd, totalUsd }. Logs a loud one-time
// alert the first time cumulative spend crosses the threshold.
function record(model, usage = {}, label = 'dossier') {
  const callUsd = costOf(model, usage);
  const s = load();
  s.totalUsd += callUsd;
  s.calls += 1;
  s.inputTokens += (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  s.outputTokens += usage.output_tokens || 0;
  s.byModel[model] = (s.byModel[model] || 0) + callUsd;
  s.updatedAt = new Date().toISOString();

  console.log(`[Usage] ${label} ${model}: $${callUsd.toFixed(4)} · cumulative $${s.totalUsd.toFixed(2)} (${s.calls} calls)`);
  if (s.totalUsd >= ALERT_USD && s.alertedAtUsd < ALERT_USD) {
    s.alertedAtUsd = s.totalUsd;
    console.warn(`\n🔔🔔 [Usage] RESEARCH SPEND OVER $${ALERT_USD} — now $${s.totalUsd.toFixed(2)} across ${s.calls} calls. (Mindaugas asked to be told. Consider the GLM-5.2 alternative.)\n`);
  }
  persist(s);
  return { callUsd, totalUsd: s.totalUsd, alert: s.totalUsd >= ALERT_USD };
}

function summary() {
  const s = load();
  return { ...s, alertThresholdUsd: ALERT_USD, overBudget: s.totalUsd >= ALERT_USD };
}

module.exports = { record, summary, costOf };
