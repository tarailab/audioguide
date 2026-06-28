// Pull a few hard, structured facts from a Wikidata entity (from the OSM
// `wikidata=Q…` tag) to ground the story and cut hallucination. Literal-valued
// properties only (dates/quantities) so no extra label-resolution round-trips.

// Wikimedia requires a descriptive User-Agent or it 403s the API.
const UA = 'AudioguideApp/1.0 (travel storyteller POC; contact: local)';

const TIME_PROPS = {
  P571: 'founded',
  P1619: 'opened',
  P729: 'in service since',
  P576: 'closed',
};
const QTY_PROPS = {
  P1082: ['population', ''],
  P2048: ['height', ' m'],
  P2044: ['elevation', ' m'],
  P2043: ['length', ' m'],
  P2046: ['area', ' km²'],
};

async function fetchWikidataFacts(qid) {
  if (!qid || !/^Q\d+$/.test(qid)) return [];
  try {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const claims = data.entities?.[qid]?.claims || {};
    const firstVal = (pid) => claims[pid]?.[0]?.mainsnak?.datavalue?.value;
    const facts = [];

    for (const [pid, label] of Object.entries(TIME_PROPS)) {
      const v = firstVal(pid);
      const y = v?.time?.match(/^[+-](\d{4})/)?.[1];
      if (y && +y > 0) facts.push(`${label}: ${parseInt(y, 10)}`);
    }
    for (const [pid, [label, unit]] of Object.entries(QTY_PROPS)) {
      const v = firstVal(pid);
      const n = v?.amount != null ? Math.abs(parseFloat(v.amount)) : NaN;
      if (!isNaN(n)) facts.push(`${label}: ${n}${unit}`);
    }
    return facts;
  } catch {
    return [];
  }
}

// Sitelink count = how many language Wikipedias cover an entity — an objective,
// persona-neutral interest signal. Batched (≤50 QIDs/call) and cached long
// (changes slowly; a periodic re-sync is a backlog item).
const cache = require('./cache');
const SITELINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function sitelinkCountOne(qid) {
  try {
    // Special:EntityData is CDN-cached (the action API rate-limits hard).
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const sl = data.entities?.[qid]?.sitelinks || {};
    return Object.keys(sl).filter(k => k.endsWith('wiki')).length;
  } catch {
    return null;
  }
}

// One EntityData call → both the sitelink count AND the short description
// (e.g. "medieval castle in Segovia"). Used by enrichOne so a single fetch
// powers interest-ranking and the minimal POI blurb. Cached like sitelinks.
async function fetchWikidataMeta(qid) {
  const empty = { sitelinks: 0, description: null };
  if (!qid || !/^Q\d+$/.test(qid)) return empty;
  const hit = cache.get(`wm:${qid}`);
  if (hit) return hit;
  try {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return empty;
    const data = await res.json();
    const ent = data.entities?.[qid] || {};
    const meta = {
      sitelinks: Object.keys(ent.sitelinks || {}).filter((k) => k.endsWith('wiki')).length,
      description: ent.descriptions?.en?.value || null,
    };
    cache.set(`wm:${qid}`, meta, SITELINK_TTL_MS);
    return meta;
  } catch {
    return empty;
  }
}

async function fetchSitelinkCounts(qids) {
  const out = {};
  const todo = [];
  for (const q of qids) {
    const hit = cache.get(`sl:${q}`);
    if (hit != null) out[q] = hit; else todo.push(q);
  }
  // Small concurrency to stay polite to the CDN.
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    await Promise.all(batch.map(async (q) => {
      const n = await sitelinkCountOne(q);
      if (n != null) { cache.set(`sl:${q}`, n, SITELINK_TTL_MS); out[q] = n; }
      else out[q] = 0;
    }));
  }
  return out;
}

module.exports = { fetchWikidataFacts, fetchSitelinkCounts, fetchWikidataMeta };
