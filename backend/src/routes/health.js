const router = require('express').Router();
const { testOllama } = require('../services/ollama');

router.get('/', async (_req, res) => {
  const ollamaOk = await testOllama();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      ollama: ollamaOk ? 'ok' : 'unreachable',
      storyProvider: process.env.STORY_PROVIDER || 'claude',
      anthropicKey: process.env.ANTHROPIC_API_KEY ? 'set' : 'missing',
    },
  });
});

module.exports = router;
