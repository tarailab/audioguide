const router = require('express').Router();
const { queryPOIs, queryBBox } = require('../services/overpass');
const { fetchWikipedia } = require('../services/wikipedia');
const { calcDistance, calcBearing, bearingToWords } = require('../utils/geo');
const { fetchSitelinkCounts } = require('../services/wikidata');
const cache = require('../services/cache');
const {
  sitelinkBonus, tagScore, posterImage, notability, valueTier, categoryOf, enrichOne,
} = require('../services/poiEnrich');

const POI_TTL_MS = 15 * 60 * 1000; // 15 min — OSM data barely changes

// Search-area defaults (metres / km-h). All tunable later from the admin panel.
const SEARCH = {
  r0: 2000,        // reach at rest
  kFwd: 180,       // forward growth per km/h
  kSide: 40,       // sideways growth per km/h
  kBack: 20,       // behind shrink per km/h
  backMin: 800,
  sideMax: 6000,
  capNormal: 20000,    // forward cap for the primary query
  capFallback: 40000,  // wider fallback when an area is sparse
  nMin: 5,             // want at least this many qualifying places
  minScore: 4,         // "notable" means score > this
};

function reaches(v, p = SEARCH) {
  return {
    fwd: Math.round(Math.min(p.capNormal, Math.max(p.r0, p.r0 + p.kFwd * v))),
    side: Math.round(Math.min(p.sideMax, Math.max(p.r0, p.r0 + p.kSide * v))),
    back: Math.round(Math.max(p.backMin, Math.min(p.r0, p.r0 - p.kBack * v))),
  };
}

// Normalised ellipse value: ≤1 means inside the search area. Centre is offset
// forward by (fwd-back)/2; semi-axes a (along travel) and b (sideways). At rest
// fwd≈side≈back so it collapses to a circle of radius r0.
function areaValue(distance, bearingDeg, course, R) {
  const c = Number.isFinite(course) ? course : 0;
  const rel = ((bearingDeg - c) * Math.PI) / 180;
  const f = distance * Math.cos(rel);
  const s = distance * Math.sin(rel);
  const off = (R.fwd - R.back) / 2;
  const a = (R.fwd + R.back) / 2;
  const b = R.side;
  return ((f - off) / a) ** 2 + (s / b) ** 2;
}

async function batchAll(items, fn, batchSize = 4) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = await Promise.all(items.slice(i, i + batchSize).map(fn));
    results.push(...batch);
  }
  return results;
}

// Enrich raw OSM POIs with Wikipedia + a notability score. Location-independent,
// cached per area so it can be reused as the user moves through it.
async function enrichArea(lat, lon, radius) {
  const rawPOIs = await queryPOIs(lat, lon, radius);
  console.log(`[POIs] ${rawPOIs.length} raw near ${lat.toFixed(3)},${lon.toFixed(3)} r=${Math.round(radius / 1000)}km`);

  const candidates = [...rawPOIs]
    .sort((a, b) => tagScore(b.tags) - tagScore(a.tags))
    .slice(0, 16);
  const withContext = await batchAll(candidates, async (poi) => {
    const wiki = await fetchWikipedia(poi.name, poi.tags);
    return { ...poi, wiki };
  }, 4);

  // Objective interest: how many language Wikipedias cover each (cached).
  const qids = [...new Set(withContext.map(p => p.tags?.wikidata).filter(q => /^Q\d+$/.test(q || '')))];
  const sl = qids.length ? await fetchSitelinkCounts(qids) : {};

  return withContext
    .map(p => {
      const sitelinks = sl[p.tags?.wikidata] || 0;
      return { ...p, sitelinks, relevanceScore: notability(p) + sitelinkBonus(sitelinks) };
    })
    .filter(p => p.relevanceScore >= 2)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 16);
}

function cacheKey(lat, lon, radius) {
  return `pois:${lat.toFixed(2)}:${lon.toFixed(2)}:${Math.round(radius / 1000)}`;
}

async function enrichCached(lat, lon, radius) {
  const key = cacheKey(lat, lon, radius);
  const enriched = await cache.remember(key, POI_TTL_MS, () => enrichArea(lat, lon, radius));
  if (!enriched.length) cache.set(key, enriched, 30 * 1000); // don't pin emptiness
  return enriched;
}

router.post('/', async (req, res) => {
  const { lat, lon, course, speedKmh = 0, heading, params } = req.body;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  // Admin panel can override the search-area params live (numbers only).
  const P = { ...SEARCH };
  if (params && typeof params === 'object') {
    for (const k of Object.keys(SEARCH)) {
      if (typeof params[k] === 'number' && isFinite(params[k])) P[k] = params[k];
    }
  }
  const R = reaches(speedKmh, P);
  const headingForWords = Number.isFinite(course) ? course : heading;

  const pack = (enriched) => enriched.map((poi) => {
    const distance = Math.round(calcDistance(lat, lon, poi.lat, poi.lon));
    const brg = calcBearing(lat, lon, poi.lat, poi.lon);
    const av = areaValue(distance, brg, course, R);
    const t = poi.tags || {};
    return {
      id: poi.id,
      name: poi.name,
      nameEn: t['name:en'] || null,
      nameLt: t['name:lt'] || null,
      etymology: t['name:etymology'] || null,
      lat: poi.lat,
      lon: poi.lon,
      tags: poi.tags,
      wiki: poi.wiki,
      image: posterImage(t),
      relevanceScore: poi.relevanceScore,
      sitelinks: poi.sitelinks ?? 0,
      tier: valueTier(poi),
      distance,
      bearing: bearingToWords(brg, headingForWords),
      inArea: av <= 1,
      areaVal: +av.toFixed(3),
    };
  });

  try {
    // 1. Primary query at the speed-based forward reach.
    const primary = pack(await enrichCached(lat, lon, R.fwd));
    let places = primary.filter((p) => p.relevanceScore > P.minScore && p.inArea);

    // 2. One wider fallback if the area came back too thin — also catches a far
    //    city you're heading toward.
    if (places.length < P.nMin && R.fwd < P.capFallback) {
      const have = new Set(places.map((p) => p.id));
      const wider = pack(await enrichCached(lat, lon, P.capFallback))
        .filter((p) => p.relevanceScore > P.minScore && !have.has(p.id))
        .sort((a, b) => a.distance - b.distance);
      places = [...places, ...wider];
    }

    // Value-aware sort: notable places float up, with a gentle distance penalty
    // (~1 point per 3 km) so a far landmark still beats a near nobody.
    const rank = (p) => p.relevanceScore - p.distance / 3000;
    places.sort((a, b) => rank(b) - rank(a));
    places = places.slice(0, 15);

    console.log(`[POIs] ${places.length} places · v=${speedKmh} fwd=${Math.round(R.fwd / 1000)}km`);
    res.json({
      places,
      area: { ...R, course: Number.isFinite(course) ? course : null, speedKmh },
    });
  } catch (err) {
    console.error('[POIs] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Trip planner ───────────────────────────────────────────────────────────

const BROWSE_TTL_MS = 10 * 60 * 1000;

// Spatially-even down-sample for the browse map. A flat top-N by score dumps
// every POI of a dense city and nothing from the countryside; this buckets the
// bbox into a grid and round-robins the highest-scoring POI from each cell, so
// the cap buys an even spread instead of one hotspot. Score still wins within a
// cell. Cheap (single pass + per-cell sort).
function sampleEvenly(places, [s, w, n, e], limit, grid = 24) {
  if (places.length <= limit) return places.slice().sort((a, b) => b.tagScore - a.tagScore);
  const latSpan = (n - s) || 1, lonSpan = (e - w) || 1;
  const cells = new Map();
  for (const p of places) {
    const r = Math.min(grid - 1, Math.max(0, Math.floor(((p.lat - s) / latSpan) * grid)));
    const c = Math.min(grid - 1, Math.max(0, Math.floor(((p.lon - w) / lonSpan) * grid)));
    const key = r * grid + c;
    const arr = cells.get(key) || cells.set(key, []).get(key);
    arr.push(p);
  }
  const buckets = [...cells.values()];
  for (const arr of buckets) arr.sort((a, b) => b.tagScore - a.tagScore);
  const out = [];
  for (let round = 0; out.length < limit; round++) {
    let progressed = false;
    for (const arr of buckets) {
      if (arr[round]) { out.push(arr[round]); progressed = true; if (out.length >= limit) break; }
    }
    if (!progressed) break;
  }
  return out;
}

// Browse a map bbox (south,west,north,east). Cheap: raw OSM + tag-only scoring,
// NO Wikipedia/Wikidata. Zoom-gated — a wide box returns only the top `limit`
// places by tagScore, so zoomed out you see headline POIs, zoomed in you see
// everything. Full A–D tier / image / wiki comes later via /enrich.
router.post('/browse', async (req, res) => {
  const { bbox, limit = 200 } = req.body || {};
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n) => !isFinite(n))) {
    return res.status(400).json({ error: 'bbox [south,west,north,east] required' });
  }
  const [south, west, north, east] = bbox.map(Number);
  if (south >= north || west >= east) return res.status(400).json({ error: 'invalid bbox' });

  const key = `browse:${[south, west, north, east].map((n) => n.toFixed(2)).join(':')}:${limit}`;
  try {
    const result = await cache.remember(key, BROWSE_TTL_MS, async () => {
      const raw = await queryBBox({ south, west, north, east });
      const scored = raw.map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lon: p.lon,
        tags: p.tags,
        tagScore: tagScore(p.tags),
        tier: valueTier({ tags: p.tags }), // provisional (tags only)
        category: categoryOf(p.tags),
        hasWiki: !!(p.tags?.wikidata || p.tags?.wikipedia),
      }));
      const cap = Math.min(500, Math.max(1, limit));
      const places = sampleEvenly(scored, [south, west, north, east], cap);
      return { places, capped: scored.length > places.length };
    });
    console.log(`[Browse] ${result.places.length} POIs in bbox ${south.toFixed(2)},${west.toFixed(2)} → ${north.toFixed(2)},${east.toFixed(2)}${result.capped ? ' (sampled)' : ''}`);
    res.json(result);
  } catch (err) {
    console.error('[Browse] Error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Full enrichment for one POI (clicked or being added to a trip): real A–D tier,
// image, wiki summary, sitelinks. Body: { poi: {id,name,lat,lon,tags} }.
router.post('/enrich', async (req, res) => {
  const { poi } = req.body || {};
  if (!poi || !poi.id || !poi.tags) return res.status(400).json({ error: 'poi {id,name,tags} required' });
  try {
    const e = await enrichOne(poi);
    res.json({
      id: e.id,
      name: e.name,
      lat: e.lat,
      lon: e.lon,
      tags: e.tags,
      wiki: e.wiki,
      image: e.image,
      tier: e.tier,
      category: e.category,
      sitelinks: e.sitelinks,
      relevanceScore: e.relevanceScore,
    });
  } catch (err) {
    console.error('[Enrich] Error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
