const fs = require('fs');
const path = require('path');

// Persisted to a host-mounted volume (see docker-compose) so the log survives
// container rebuilds. One JSON object per line (JSONL).
const DIR = path.join(__dirname, '../../data');
const FILE = path.join(DIR, 'stories.jsonl');

function append(entry) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('[StoryLog] write failed:', err.message);
  }
}

function readAll(limit = 500) {
  try {
    const lines = fs.readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .reverse(); // newest first
  } catch {
    return [];
  }
}

module.exports = { append, readAll };
