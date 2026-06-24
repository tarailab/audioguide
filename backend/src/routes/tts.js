const router = require('express').Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { synthesize, voiceFor } = require('../services/ttsProxy');

// Cache rendered audio on disk (volume) so a place narrated again — or by a
// second device — is instant and costs no synthesis.
const DIR = path.join(__dirname, '../../data/tts');

router.post('/', async (req, res) => {
  const { text, language = 'en' } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const key = crypto.createHash('sha1')
    .update(`${voiceFor(language)}|${text}`)
    .digest('hex');
  const file = path.join(DIR, `${key}.mp3`);

  try {
    if (!fs.existsSync(file)) {
      const buf = await synthesize(text, language);
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(file, buf);
      console.log(`[TTS] rendered ${buf.length} bytes for "${text.slice(0, 40)}…"`);
    }
    res.type('audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000');
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error('[TTS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
