const router = require('express').Router();
const { condenseSummary } = require('../services/ollama');
const { generateStory } = require('../services/claude');
const cache = require('../services/cache');
const storyLog = require('../services/storyLog');

const STORY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Review the log of every generated story (newest first).
router.get('/log', (req, res) => {
  res.json(storyLog.readAll());
});

router.post('/', async (req, res) => {
  const {
    poi,
    interests = [],
    tone = 'storyteller',
    length = '1min',
    language = 'en',
    bearing = 'ahead',
  } = req.body;

  if (!poi?.name) return res.status(400).json({ error: 'poi with name required' });

  // Cache key: same place + same story settings → identical story.
  // Bearing is deliberately excluded so the cache survives passing a place
  // from a different direction. id falls back to name when OSM id is missing.
  const key = [
    'story',
    poi.id || poi.name,
    length, language, tone,
    [...interests].sort().join('+'),
  ].join(':');

  try {
    const story = await cache.remember(key, STORY_TTL_MS, async () => {
      // Condense Wikipedia extract via Ollama (bypassed — re-enable when warm)
      const USE_OLLAMA_CONDENSER = false;
      let context = poi.wiki?.extract || `${poi.name} — a notable place`;
      if (USE_OLLAMA_CONDENSER && context.length > 300) {
        console.log(`[Story] Condensing ${context.length} chars via Ollama`);
        context = await condenseSummary(context, interests);
      }
      console.log(`[Story] Generating story for "${poi.name}" (${length}, ${language})`);
      const text = await generateStory({ poi, context, interests, tone, length, language, bearing });

      // Persist every newly generated story for later review.
      storyLog.append({
        ts: new Date().toISOString(),
        id: poi.id || null,
        name: poi.name,
        lat: poi.lat ?? null,
        lon: poi.lon ?? null,
        place: poi.tags?.place || poi.tags?.historic || poi.tags?.tourism || null,
        relevanceScore: poi.relevanceScore ?? null,
        length, language, tone, interests,
        hasWiki: !!poi.wiki,
        story: text,
      });
      return text;
    });

    res.json({ story, poi: poi.name });
  } catch (err) {
    console.error('[Story] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
