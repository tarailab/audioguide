const router = require('express').Router();
const { queryPOIs } = require('../services/overpass');
const { fetchWikipedia } = require('../services/wikipedia');
const { calcDistance, calcBearing, bearingToWords } = require('../utils/geo');

// Run promises in batches to avoid hammering APIs
async function batchAll(items, fn, batchSize = 4) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = await Promise.all(items.slice(i, i + batchSize).map(fn));
    results.push(...batch);
  }
  return results;
}

router.post('/', async (req, res) => {
  const { lat, lon, heading, interests = [], radius = 2000 } = req.body;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  try {
    // 1. Raw POIs from OSM
    const rawPOIs = await queryPOIs(lat, lon, radius);
    console.log(`[POIs] ${rawPOIs.length} raw POIs near ${lat},${lon}`);

    // 2. Wikipedia — top 10 only, in batches of 4
    const candidates = rawPOIs.slice(0, 10);
    const withContext = await batchAll(candidates, async (poi) => {
      const wiki = await fetchWikipedia(poi.name, poi.tags);
      return { ...poi, wiki };
    }, 4);

    const withWiki = withContext;
    console.log(`[POIs] ${withContext.filter(p => p.wiki).length}/${withContext.length} have Wikipedia articles`);

    // 3. Ollama relevance filter (bypassed — slow cold start, re-enable when Ollama is warm)
    const USE_OLLAMA_FILTER = false;
    const withScores = USE_OLLAMA_FILTER
      ? await batchAll(withWiki, async (poi) => {
          const score = await filterRelevance(poi.name, poi.tags, interests);
          return { ...poi, relevanceScore: score };
        }, 3)
      : withWiki.map(p => ({ ...p, relevanceScore: 8 }));

    // 4. Filter, sort, take top 6
    const filtered = withScores
      .filter(p => p.relevanceScore >= 5)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 6);

    // 5. Add distance + bearing
    const result = filtered.map(poi => ({
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

    console.log(`[POIs] Returning ${result.length} filtered POIs`);
    res.json(result);
  } catch (err) {
    console.error('[POIs] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
