const router = require('express').Router();
const { queryPOIs } = require('../services/overpass');
const { fetchWikipedia } = require('../services/wikipedia');
const { filterRelevance } = require('../services/ollama');
const { calcDistance, calcBearing, bearingToWords } = require('../utils/geo');

router.post('/', async (req, res) => {
  const { lat, lon, heading, interests = [], radius = 12000 } = req.body;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  try {
    // 1. Raw POIs from OSM
    const rawPOIs = await queryPOIs(lat, lon, radius);
    console.log(`[POIs] Found ${rawPOIs.length} raw POIs near ${lat},${lon}`);

    // 2. Wikipedia context (parallel, cap at 15 candidates)
    const candidates = rawPOIs.slice(0, 15);
    const withContext = await Promise.all(
      candidates.map(async (poi) => {
        const wiki = await fetchWikipedia(poi.name);
        return { ...poi, wiki };
      })
    );

    // 3. Ollama relevance filter (parallel) — skip if no interests set
    const withScores = await Promise.all(
      withContext
        .filter(p => p.wiki) // only POIs with Wikipedia articles
        .map(async (poi) => {
          const score = await filterRelevance(poi.name, poi.tags, interests);
          return { ...poi, relevanceScore: score };
        })
    );

    // 4. Filter, sort, take top 6
    const filtered = withScores
      .filter(p => p.relevanceScore >= 5)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 6);

    // 5. Enrich with distance + bearing
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
