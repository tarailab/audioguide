require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/health', require('./routes/health'));
app.use('/api/pois', require('./routes/pois'));
app.use('/api/story', require('./routes/story'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Audioguide backend on http://0.0.0.0:${PORT}`);
  console.log(`Story provider: ${process.env.STORY_PROVIDER || 'claude'}`);
  console.log(`Ollama: ${process.env.OLLAMA_URL || 'http://localhost:11434'}`);
});
