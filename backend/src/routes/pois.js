const router = require('express').Router();
const { queryPOIs } = require('../services/overpass');
const { fetchWikipedia } = require('../services/wikipedia');
const { calcDistance, calcBearing, bearingToWords } = require('../utils/geo');
const { fetchSitelinkCounts } = require('../services/wikidata');
const cache = require('../services/cache');

// Objective interest from Wikidata sitelinks: capped bonus to the score.
const sitelinkBonus = (n) => Math.min(6, Math.floor((n || 0) / 3));

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

function tagScore(tags = {}) {
  let s = 1;
  if (tags.wikidata || tags.wikipedia) s += 2;
  if (tags.heritage) s += String(tags['heritage:operator'] || '').includes('whc') ? 6 : 3;
  if (tags.historic) s += 3;
  if (tags.tourism && tags.tourism !== 'information') s += 2;
  if (tags.man_made === 'lighthouse') s += 3;
  if (['windmill', 'watermill', 'tower', 'obelisk'].includes(tags.man_made)) s += 2;
  if (tags.geological) s += 2;
  if (tags.place === 'city') s += 5;
  if (tags.place === 'town') s += 3;
  if (tags.place === 'village' || tags.place === 'hamlet') s += 1;
  if (tags.place === 'suburb') s += 1;
  if (tags.natural) s += 1;
  if (tags.memorial || tags.monument) s += 2;
  return s;
}

// Best available thumbnail: a direct image URL, else a Commons file rendered at
// a sane width via Special:FilePath.
function posterImage(tags = {}) {
  if (tags.image && /^https?:\/\//.test(tags.image)) return tags.image;
  const c = tags.wikimedia_commons;
  if (c && c.startsWith('File:')) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(c.slice(5))}?width=480`;
  }
  return null;
}

function notability(poi) {
  return tagScore(poi.tags) + (poi.wiki ? 6 : 0);
}

// Rough value tier on two axes (the 2×2), so all tiers populate instead of a
// blended score collapsing into a bimodal has-wiki/no-wiki split:
//   A interesting + documented   B interesting + thin (value-add zone)
//   C ordinary  + documented     D ordinary + thin
// Objective/persona-aware interest (sitelinks, pageviews, age) is backlog.
function interestHigh(t = {}) {
  if (t.historic || t.heritage || t.geological) return true;
  if (['lighthouse', 'windmill', 'watermill', 'tower', 'obelisk'].includes(t.man_made)) return true;
  if (t.tourism && t.tourism !== 'information') return true;
  if (['waterfall', 'peak', 'cave_entrance', 'volcano', 'geyser', 'cliff', 'arch', 'hot_spring'].includes(t.natural)) return true;
  if (t.place === 'city' || t.place === 'town') return true;
  return false; // village / hamlet / suburb / generic
}
function dataHigh(poi) {
  const t = poi.tags || {};
  return !!poi.wiki || !!t.wikipedia || !!t.wikidata;
}
function valueTier(poi) {
  // Sitelinks promote interest objectively (a well-covered artwork IS notable).
  const i = interestHigh(poi.tags) || (poi.sitelinks || 0) >= 5;
  const d = dataHigh(poi);
  if (i && d) return 'A';
  if (i && !d) return 'B';
  if (!i && d) return 'C';
  return 'D';
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

module.exports = router;
