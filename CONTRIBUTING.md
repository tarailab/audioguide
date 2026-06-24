# Working conventions

Lightweight process for this project (solo + Claude Code). Keep it lean.

## Backlog lives in GitHub Issues + the "AI Audioguide" Project board
- **Issues = backlog items.** Claude writes them with scope; you curate.
- **Board columns (Status):** `Inbox → Defined → Ready → Doing → Done`.
  - *Inbox* — raw idea, not yet scoped (park tangents here in 5s).
  - *Defined* — scoped, has enough detail to act.
  - *Ready* — prioritized + unblocked → Claude may pick it up.
  - *Doing / Done* — in progress / shipped.
- **Priority** via labels `P0-blocker … P3-low`. **Tracks** via `core-pipeline`,
  `ui-ux`, `ai-smart`, `infra`.
- **Blocking:** a `needs-decision` label + the question in the issue. Answer in a
  comment → Claude unblocks. Nothing in `Ready` should be `needs-decision`.

### The loop
1. You drag issues into `Ready` in priority order.
2. Claude pulls the top `Ready` issue (skip `needs-decision`) and implements it.
3. Decisions get logged **as issue comments**, not lost in chat.

## One track per session
Start a **fresh Claude Code session per coherent task** ("implement #29",
"B2 model eval"). Continuity is carried by **memory + docs + issues**, not by one
endless chat. Long single sessions bloat context and lose nuance.

## Model usage
- **Sonnet** (or Opus fast mode) for the mechanical ~70% — wiring, queries,
  debugging, boilerplate.
- **Opus** for design/architecture/tradeoffs and when you want pushback.
- Reserve **high thinking effort** for genuinely hard reasoning.

## Dev loop (so we never lose hours to stale code again)
- Frontend hot-reloads via Vite **polling** (`vite.config.js`) — required on
  Windows+Docker bind mounts.
- Every change bumps `frontend/src/version.js` + `public/version.json`. The
  on-screen badge shows `v<date.n>`; it turns red + auto-reloads if the running
  bundle is stale. **Confirm the badge version after reloading.**
- Caddy sends `no-store`; no service worker (PWA removed for the dev server).

## Commits
- Commit when a unit of work is verified; push on request.
- Never commit `certs/`, `.env`, `osm/`, `tts/`, `backend/data/` (gitignored).
