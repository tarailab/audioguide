# Testing & quality system — audioguide

This project has an automated quality system with **three concerns** (functionality/
usability, security, best-practices) running at **two layers** (fast automatic checks
that cost nothing, and a once-a-day AI reviewer that gives you opinions and
recommendations). You don't need to be a developer to use it.

---

## TL;DR — what runs, when, and what it costs

| Layer | What it does | When | Cost |
|---|---|---|---|
| **Deterministic gates** | UI tests (real browser), lint, secret scan, dependency audit | Every push (GitHub Actions) + on demand | **Free** — no AI, no GPU |
| **Agentic review** | An AI uses the app, judges usability + design + security, writes a report | Once a day (scheduled) | Small — one diff-scoped AI run/day |

The fast layer catches breakages. The AI layer tells you how to make it better and
more professional. They're separate on purpose so the cheap checks can run constantly.

---

## Layer 1 — Deterministic gates (free, instant)

These are plain code. They never call Claude/OpenAI and never touch the GPU.

```bash
npm run test:ui        # UI tests: drive the real app in a browser (backend mocked)
npm run lint           # code-quality lint
npm run format:check   # consistent formatting
npm run secrets:scan   # scan for leaked API keys/tokens (needs gitleaks installed)
npm run deps:audit     # known-vulnerable dependencies
npm run qa             # lint + format + UI tests together
```

**The UI tests are the important part for you:** every test clicks through the real
interface in a real browser (Chromium at a phone screen size) — not just the API.
They live in `tests/e2e/`. The backend is faked at the network layer so they're fast,
repeatable, and cost nothing. They run automatically on every push via
`.github/workflows/qa.yml`.

**Visual regression:** `tests/e2e/visual.spec.js` screenshots the UI and fails if the
layout changes unexpectedly. If you *intend* a visual change, refresh the baseline:

```bash
npm run test:ui -- --update-snapshots
```

(Visual baselines are Windows-specific, so they run locally, not in cloud CI.)

### Adding a test when you change the UI
You asked that every UI change be tested *through the UI*. The pattern:
1. Copy an existing spec in `tests/e2e/` (e.g. `preferences.spec.js`).
2. Describe the user action ("click X", "type Y") and what should happen.
3. `npm run test:ui`.

Or just ask Claude Code: *"add a UI test for the new trip-rename flow."*

---

## Layer 2 — Agentic review (the AI "test agent")

This is the part that **judges quality and gives you recommendations** — the thing
that keeps the app from looking like amateur "vibe-coded" work.

Run it any time:

```powershell
pwsh -File qa/run-review.ps1          # daily-style review (cheap, Sonnet)
pwsh -File qa/run-review.ps1 -Deep    # deeper weekly review (Opus)
```

What it does:
1. Figures out **what changed** since the last review (so it stays cheap).
2. Runs the UI tests and **screenshots every screen** (phone + desktop).
3. An AI agent **looks at the screenshots, reads the diff**, and grades the app
   against three rubrics in `qa/rubrics/`:
   - `usability.md` — does it work? is it pleasant? are loading/empty/error states there?
   - `design-architecture.md` — does it look professional? is the code clean?
   - `security.md` — any vulnerabilities, leaked secrets, or cost/abuse exposure?
4. Writes a dated report to **`qa/reports/YYYY-MM-DD-review.md`** — a verdict, a
   "professionalism score", and a prioritised list of concrete fixes.

You just read the report. It's written in plain language, impact first.

### Turn on the automatic loop
```powershell
pwsh -File qa/schedule-review.ps1     # registers a daily Windows scheduled task
```
A fresh report lands in `qa/reports/` every morning. Remove it any time with
`Unregister-ScheduledTask -TaskName 'audioguide-qa-review'`.

> **Token/cost note:** only step 4 spends tokens, it's scoped to the daily diff, and
> it defaults to the cheaper Sonnet model. The review runs as its own background
> process — it does **not** consume your interactive Claude Code session's context.

---

## One-time prerequisites
- **Node deps:** `npm install && npm run install:all` then `npx playwright install chromium`.
- **gitleaks** (secret scanning) — optional locally, runs in CI regardless. Install:
  `winget install gitleaks` or download from https://github.com/gitleaks/gitleaks/releases.
- **Claude CLI** on PATH for the agentic review (you already have it).

## Where things live
```
tests/e2e/            UI tests (real browser) + visual baselines
playwright.config.js  test runner config
eslint.config.js      lint rules
.gitleaks.toml        secret-scan rules
qa/rubrics/           the standards the AI reviewer grades against
qa/review-playbook.md the AI reviewer's instructions
qa/run-review.ps1     run one review
qa/schedule-review.ps1 turn on the daily loop
qa/reports/           dated review reports land here
.github/workflows/    CI: deterministic gates on every push
```
