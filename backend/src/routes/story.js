const router = require('express').Router();
const { condenseSummary } = require('../services/ollama');
const { generateStory } = require('../services/claude');

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

  try {
    // Condense Wikipedia extract via Ollama (bypassed — re-enable when Ollama is warm)
    const USE_OLLAMA_CONDENSER = false;
    let context = poi.wiki?.extract || `${poi.name} — a notable place`;
    if (USE_OLLAMA_CONDENSER && context.length > 300) {
      console.log(`[Story] Condensing ${context.length} chars via Ollama`);
      context = await condenseSummary(context, interests);
    }

    console.log(`[Story] Generating story for "${poi.name}" (${length}, ${language})`);
    const story = await generateStory({ poi, context, interests, tone, length, language, bearing });

    res.json({ story, poi: poi.name });
  } catch (err) {
    console.error('[Story] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
