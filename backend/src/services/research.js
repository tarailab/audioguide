// Multi-source, local-language-first content GATHERING for the deep-research /
// dossier track. Anchored on Wikidata/Wikipedia (a trusted base), it:
//   1. pulls the LOCAL-language article(s) first (Catalan/Basque/Galician for
//      Spain, Lithuanian/Latvian for the Baltics), then Spanish/English;
//   2. harvests each article's cited REFERENCE links (often richer than the
//      article itself — the user's insight) for the later fetch/extract stage;
//   3. falls back to the parent COUNTY/region (Wikidata P131) when a place's own
//      coverage is thin — so "search around / search the county" is automatic.
// This layer GATHERS with provenance only. It does NOT verify/refute — that was
// the spike's mistake (it killed true facts). Confidence is attached later, by
// source trust, in the extraction stage.

const cache = require('./cache');

const UA = 'AudioguideApp/1.0 (audioguide research; contact: local)';
const WD = 'https://www.wikidata.org';
const GATHER_TTL_MS = 6 * 60 * 60 * 1000; // 6h — source corpus changes slowly

// Candidate languages: regional (Catalan/Basque/Galician/Lithuanian/Latvian) +
// national (Spanish) + English. We fetch every candidate that exists, then keep
// the RICHEST — that reveals the truly-local language (a Catalan town's `ca`
// article is the substantive one; a Castilian city's `es` is) instead of
// grabbing a regional-language stub just because it exists.
const CANDIDATE_LANGS = ['ca', 'eu', 'gl', 'lt', 'lv', 'es', 'en'];
const MAX_LANGS = 4;
const EXTRACT_CAP = 7000;   // chars kept per article
const THIN_CHARS = 1500;    // combined place text below this → pull the county
const MAX_REFS = 60;

// Serialize all Wikimedia calls through one queue with a min gap. A single
// gather fires ~15 calls; without spacing a burst (or a bulk pre-gen run) gets
// rate-limited (429) and silently returns empty — which would read as "no data"
// and is exactly the false-negative we must avoid.
const MIN_GAP_MS = 120;
let chain = Promise.resolve();
let lastAt = 0;
function throttle(fn) {
  const run = chain.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  });
  chain = run.then(() => {}, () => {});
  return run;
}

async function rawFetch(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(9000) });
  if (res.status === 429 || res.status >= 500 || !res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      return await throttle(() => rawFetch(url));
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 800 * (i + 1))); // back off on 429/5xx/timeout
    }
  }
}

// Name → Wikidata QID, when a POI has no wikidata tag.
async function resolveQid(name) {
  if (!name) return null;
  const url = `${WD}/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=es&format=json&limit=1&origin=*`;
  try { return (await getJson(url)).search?.[0]?.id || null; } catch { return null; }
}

// Wikidata entity → {sitelinks{lang:title}, parentQid (P131), description}.
async function entity(qid) {
  const empty = { sitelinks: {}, parentQid: null, description: null };
  if (!/^Q\d+$/.test(qid || '')) return empty;
  try {
    const d = await getJson(`${WD}/wiki/Special:EntityData/${qid}.json`);
    const e = d.entities?.[qid] || {};
    const sitelinks = {};
    for (const [site, v] of Object.entries(e.sitelinks || {})) {
      if (!site.endsWith('wiki')) continue;          // skip wikiquote/wikivoyage/etc
      const lang = site.slice(0, -4);
      if (/^[a-z]{2,3}$/.test(lang)) sitelinks[lang] = v.title;
    }
    return {
      sitelinks,
      parentQid: e.claims?.P131?.[0]?.mainsnak?.datavalue?.value?.id || null,
      description: e.descriptions?.es?.value || e.descriptions?.en?.value || null,
    };
  } catch { return empty; }
}

const wikiApi = (lang) => `https://${lang}.wikipedia.org/w/api.php`;

// Plain-text article body (capped). Full article, not just the intro — depth is
// the point.
async function fetchExtract(lang, title) {
  const url = `${wikiApi(lang)}?action=query&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  try {
    const d = await getJson(url);
    const page = Object.values(d.query?.pages || {})[0];
    const text = page?.extract || '';
    return text.length > EXTRACT_CAP ? `${text.slice(0, EXTRACT_CAP)}…` : text;
  } catch { return ''; }
}

// External/citation links from the article = the reference sources to mine next.
async function fetchExtLinks(lang, title) {
  const url = `${wikiApi(lang)}?action=query&prop=extlinks&ellimit=max&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  try {
    const d = await getJson(url);
    const page = Object.values(d.query?.pages || {})[0];
    return (page?.extlinks || []).map((l) => l.url || l['*']).filter(Boolean);
  } catch { return []; }
}

// Keep real external sources; drop wiki-internal/metadata noise. KEEP archive.org
// (the user's besalu.cat example is an archived official page) and books/news.
function cleanRefs(urls) {
  const drop = /([a-z-]+\.wikipedia\.org|wikidata\.org|wikimedia\.org|\/\/commons\.|\.wiktionary\.|\/\/[a-z-]+\.wikisource\.)/i;
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    if (!/^https?:\/\//i.test(u) || drop.test(u)) continue;
    const key = u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= MAX_REFS) break;
  }
  return out;
}

async function articlesFor(sitelinks) {
  const cand = CANDIDATE_LANGS.filter((l) => sitelinks[l]);
  const arts = [];
  for (const lang of cand) {
    const title = sitelinks[lang];
    const [text, refs] = await Promise.all([fetchExtract(lang, title), fetchExtLinks(lang, title)]);
    arts.push({ lang, title, chars: text.length, text, refs });
  }
  // Keep the richest articles (the substantive ones); drop empty/stub langs.
  arts.sort((a, b) => b.chars - a.chars);
  return arts.filter((a) => a.chars > 0).slice(0, MAX_LANGS);
}

// Gather everything for one POI. Returns a provenance-tagged corpus ready for the
// extraction stage. Cached per QID (the corpus changes slowly), and never throws
// — returns a `note` when there's nothing. Don't cache empty results (likely a
// transient rate-limit, not a real "no data").
async function gatherSources(poi) {
  const name = poi?.name;
  let qid = /^Q\d+$/.test(poi?.tags?.wikidata || '') ? poi.tags.wikidata : null;
  if (!qid) qid = await resolveQid(name);
  if (!qid) return { qid: null, name, languages: [], articles: [], parent: null, refs: [], note: 'no Wikidata entity' };

  const cached = cache.get(`research:gather:${qid}`);
  if (cached) return cached;
  const result = await gatherForQid(qid, name);
  if (result.combinedChars > 0) cache.set(`research:gather:${qid}`, result, GATHER_TTL_MS);
  return result;
}

async function gatherForQid(qid, name) {

  const ent = await entity(qid);
  const articles = await articlesFor(ent.sitelinks);
  const combinedChars = articles.reduce((n, a) => n + a.chars, 0);

  // Thin place → widen to the parent admin unit (comarca/county/province).
  let parent = null;
  if (combinedChars < THIN_CHARS && ent.parentQid) {
    const pe = await entity(ent.parentQid);
    parent = { qid: ent.parentQid, articles: await articlesFor(pe.sitelinks) };
  }

  const refs = cleanRefs([
    ...articles.flatMap((a) => a.refs),
    ...(parent?.articles.flatMap((a) => a.refs) || []),
  ]);

  return {
    qid, name,
    description: ent.description,
    languages: articles.map((a) => a.lang),
    articles,                       // [{lang,title,chars,text,refs}]
    parent,                         // null | {qid, articles}
    refs,                           // deduped external citation URLs to mine next
    combinedChars,
    widened: !!parent,
  };
}

module.exports = { gatherSources, resolveQid, entity };
