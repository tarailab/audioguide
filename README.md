# AI Audioguide

GPS-aware AI storyteller for travellers. Proactively delivers audio stories about nearby landmarks, history, and culture as you drive or walk — no searching required.

## What it does
- Detects your location and speed (car vs walk mode)
- Finds interesting POIs ahead of you via OpenStreetMap
- Generates narrative stories via Claude API (or local Ollama)
- Plays them via text-to-speech, hands-free
- Learns your preferences from reactions over time
- Alerts on country crossings (speed limits, currency, roaming)

## Stack
- **Frontend**: React PWA (Vite) — runs in phone browser
- **Backend**: Node.js/Express — hosted on tarailab, accessed via Tailscale
- **Data**: OpenStreetMap (Overpass API) + Wikipedia API
- **AI**: Claude Haiku (stories) + Ollama qwen3.5:9b (relevance filter)
- **TTS**: Claude audio output

## Quick start
```bash
# Backend
cd backend && cp .env.example .env  # fill in ANTHROPIC_API_KEY
npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## Milestones
- **M1** — Working POC on phone (core pipeline + basic UI)
- **M2** — Smart features (reactions, country crossing, provider switch)
- **M3** — Quality & polish (caching, offline, install to homescreen)
