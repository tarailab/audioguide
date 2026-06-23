const router = require('express').Router();
const { queryPOIs } = require('../services/overpass');
const { fetchWikipedia } = require('../services/wikipedia');
const { calcDistance, calcBearing, bearingToWords } = require('../utils/geo');
const cache = require('../services/cache');

const POI_TTL_MS = 15 * 60 * 1000; // 15 min — OSM data barely changes

// Run promises in batches to avoid hammering APIs
async function batchAll(items, fn, batchSize = 4) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = await Promise.all(items.slice(i, i + batchSize).map(fn));
    results.push(...batch);
  }
  return results;
}

// Tag-only score, known before any Wikipedia lookup. Used to pick which raw
// POIs are worth enriching, so a big city is never sliced off in a dense area.
function tagScore(tags = {}) {
  let s = 1;
  if (tags.wikidata || tags.wikipedia) s += 2;
  if (tags.historic) s += 3;
  if (tags.tourism && tags.tourism !== 'information') s += 2;
  if (tags.place === 'city') s += 5;
  if (tags.place === 'town') s += 3;
  if (tags.place === 'village' || tags.place === 'hamlet') s += 1;
  if (tags.place === 'suburb') s += 1;
  if (tags.natural) s += 1;
  if (tags.memorial || tags.monument) s += 2;
  return s;
}

// Full story-worthiness. Wikipedia presence is the strongest notability signal.
function notability(poi) {
  return tagScore(poi.tags) + (poi.wiki ? 6 : 0);
}

// Enrich raw OSM POIs with Wikipedia + a notability score. Location-independent,
// so it can be cached per area and reused as the user moves through it.
async function enrichArea(lat, lon, radius) {
  const rawPOIs = await queryPOIs(lat, lon, radius);
  console.log(`[POIs] ${rawPOIs.length} raw POIs near ${lat.toFixed(3)},${lon.toFixed(3)}`);

  // Pre-rank by tags before the (limited) Wikipedia enrichment so cities/towns
  // and historic sites survive the cut in dense areas.
  const candidates = [...rawPOIs]
    .sort((a, b) => tagScore(b.tags) - tagScore(a.tags))
    .slice(0, 12);
  const withContext = await batchAll(candidates, async (poi) => {
    const wiki = await fetchWikipedia(poi.name, poi.tags);
    return { ...poi, wiki };
  }, 4);
  console.log(`[POIs] ${withContext.filter(p => p.wiki).length}/${withContext.length} have Wikipedia articles`);

  return withContext
    .map(p => ({ ...p, relevanceScore: notability(p) }))
    .filter(p => p.relevanceScore >= 2)        // drop noise (benches, bus stops)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);
}

router.post('/', async (req, res) => {
  const { lat, lon, heading, radius = 2000 } = req.body;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  // Cache per ~1.1 km grid cell + radius bucket, with in-flight de-dup so the
  // rapid-fire discovery calls while driving collapse into one Overpass hit.
  const key = `pois:${lat.toFixed(2)}:${lon.toFixed(2)}:${Math.round(radius / 1000)}`;

  try {
    const enriched = await cache.remember(key, POI_TTL_MS, () => enrichArea(lat, lon, radius));
    // Don't pin an empty result for the full TTL — a transient upstream failure
    // shouldn't make an area look dead for 15 min. Let it retry soon.
    if (!enriched.length) cache.set(key, enriched, 30 * 1000);

    // Distance + bearing are always recomputed from the exact live position,
    // so caching by grid cell never makes the distances stale.
    const result = enriched.map(poi => ({
      id: poi.id,
      name: poi.name,
      lat: poi.lat,
      lon: poi.lon,
      tags: poi.tags,
      wiki: poi.wiki,
      relevanceScore: poi.relevanceScore,
      distance: Math.round(calcDistance(lat, lon, poi.lat, poi.lon)),
      bearing: bearingToWords(calcBearing(lat, lon, poi.lat, poi.lon), heading),
    }));

    console.log(`[POIs] Returning ${result.length} POIs (key ${key})`);
    res.json(result);
  } catch (err) {
    console.error('[POIs] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
