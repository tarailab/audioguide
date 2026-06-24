# Audioguide — Backlog

Captured from the 2026-06-23 helicopter-view UX/architecture review.
Ordered roughly by experience-per-effort. Not all of these are committed work —
this is the running list of known improvements.

## ⏭️ Next iteration (decided 2026-06-24 — OSM opportunities)

1. **Wikidata fact-grounding** — from a POI's `wikidata=Q…`, fetch structured
   facts (founded, architect, height, notable people) and feed those to Claude
   instead of free prose → fewer hallucinations, better stories.
2. **Expanded POI categories** — add `man_made=lighthouse/windmill/watermill/
   tower/obelisk`, `tourism=viewpoint/artwork`, UNESCO/`heritage=*`, broader
   `historic`/`natural`. Extend the Overpass query + notability scoring.
3. **Multilingual names + etymology** — use `name:en`/`name:lt` per language
   (fixes naming/pronunciation), and `name:etymology[:wikidata]` as a story hook.
4. **Image thumbnail** — `wikimedia_commons`/`image`: small thumbnail *inside*
   the story text, hidden by default, **expands on click** (not a big image —
   app is audio-first).

## 📋 Backlog (decided 2026-06-24)

- **Region & border announcements** *(for sure)* — admin boundaries → "entering
  Samogitia", "crossing into Latvia". Needs crossing-detection logic.
- **Themed journeys** *(nice to have)* — map interests to real OSM tag sets:
  "castles & manors", "war history", "natural wonders". Includes a
  **geology / industrial / underground** theme for city dwellers (volcanoes,
  caves, mines, quarries, abandoned industry, tunnels, bunkers — see tag notes
  in session). Baltics are geology-poor (flat/glaciated); Spain + Canaries are
  geology-rich → another reason Spain is a good 2nd region.
- **Driver-utility layer** *(nice to have)* — fuel/EV/food/rest ahead
  (`amenity=*`). Different feature from the storyteller core; keep it from
  diluting focus.

## 🛠️ Idle / background tasks (decided 2026-06-24, important)

Run when not actively working on other things (consider a background agent).
Best split into three dependent steps:

- **B1. Self-hosted POI source — ✅ DONE (LT+LV, 2026-06-24).**
  `wiktorn/overpass-api` container with merged LT+LV extract (342 MB pbf,
  ~319k tagged nodes). Backend uses it first inside the Baltics bbox, public
  mirrors as fallback elsewhere. No more 504s in-region. *Next regions:*
  Spain → assess Europe disk/RAM (use filtered extract for those).
- **B2. Model comparison for story generation** (do BEFORE bulk gen).
  Compare local (Ollama) vs Claude vs GPT on quality / cost / latency over a
  representative POI sample. Likely conclusion: **local model for free bulk
  pre-gen, Claude on-demand for premium** — controls cost.
- **B3. Bulk pre-generate stories for all of LT** (depends on B1 + B2).
  Generate + cache a baseline story per notable POI → instant playback,
  offline, reviewable corpus. Cost depends entirely on the model chosen in B2.
  *Open scope: how many POIs, which length/tone/language matrix — clarify.*

## 📌 Parked

### Public / closed-testing hosting
Expose to outside testers without LAN/Tailscale exposure; Google-login +
whitelist. Approach decided, not built. Full plan: `D:\AI\PUBLIC_HOSTING_PLAYBOOK.md`
(Cloudflare Tunnel + Access default; VPS + oauth2-proxy scale-up). Needs the
hardening checklist (rate limits, clamp params, strip admin) before exposure.

### POI source resilience / alternatives
Overpass public servers are flaky (504s, rate limits) — the single biggest
reliability risk. Options evaluated 2026-06-24:
- **Self-host Overpass** with a regional OSM extract (LT+LV from Geofabrik) on
  the lab box → kills flakiness, keeps OSM's rich heritage tags, free. **Top pick.**
- **Wikipedia GeoSearch API** as a complementary source — returns places that
  *have an article* (= notable by definition, with story text we already fetch).
- **Google Places: rejected** — costs $, ToS restricts caching/storing results
  and requires display on a Google map, and it's business-oriented (worse for
  hillforts/heritage than OSM). Poor fit for a heritage storyteller.

## 🔴 Structural (define how good the app can get)

### 1. Look-ahead pre-generation (the driving fix)
The pipeline is reactive: enter trigger radius → discover → fetch Wikipedia →
call Claude → speak (~10–15s). At 90 km/h that's ~375m travelled before audio
starts, so the story plays after you've passed the POI.
- Discover POIs along heading, not just around you.
- Pre-generate the next 1–2 stories (incl. audio) while the current one plays.
- Arrival playback is then instant.
- **Partially addressed** by speed-dynamic radius (see "Done" below); full
  pre-generation still pending.

### 2. Voice quality (the experience transformer)
Web Speech API uses the robotic Android system voice; Lithuanian may not exist
on-device at all. The story text is good; the delivery isn't.
- Quick win: cloud TTS (OpenAI / ElevenLabs) for English.
- Strategic: converge with the in-house `lt-tts-poc` (F5-TTS on LIEPA-3) for a
  natural Lithuanian voice, local, no per-word cost.

## 🟡 Quality / correctness

### 5. Select POIs *ahead*, not just nearest
Heading/bearing are computed but selection is distance-only — a POI behind you
can trigger. Prioritise what's coming up on the path.
- **Partially addressed** by the forward-arc auto-trigger filter (see "Done").

### 6. Honest empty/error states
Overpass is flaky; on failure the app silently shows "Ready" with nothing. The
user can't tell broken from quiet. Surface "couldn't reach map data, retrying."

## 🟡 Dead / misleading controls

### 7. "Story Engine" selector does nothing
`storyProvider` (Claude/GPT-4o/Local) is never passed to `fetchStory`; backend is
hardwired to Claude. Either wire it or hide it.

### 8. Tone "Casual" maps to nothing
`deriveTone` expects `friend`; the UI sends `casual`, which silently falls back
to storyteller.

### 9. "Length" vs "Density" confusion
Two time-ish axes (Length 30s–5min; Density sparse/normal/rich labelled in
minutes) users will conflate. Merge or rename.

## 🟡 Platform

### 10. Backgrounding limitation
As a PWA, geolocation + speech stop when the screen locks or the app is
backgrounded. A true road-trip companion (screen off) eventually needs a native
wrapper (Capacitor). Blocks "real drive" usage, not testing.

---

## ✅ Done

- Interrupt-safe playback (play-token invalidates stale story callbacks).
- Map follows position + heading arrow.
- Auto / manual mode toggle; reload button.
- Mobile TTS unlock + keep-alive (fixes silent / cut-off audio).
- **Speed-dynamic discovery radius** — scales ~1 km walking → ~5–6 km at
  highway speed; auto-trigger biased to a forward arc when moving.
- **Story caching** — server-side, 30-day TTL, keyed by place + settings
  (5.7s → 0.1s on repeat, identical output).
- **POI caching + Overpass throttling** — 15-min per-grid-cell cache with
  in-flight de-dup, plus serialized 1.2s-spaced upstream calls. Kills the 429
  storm at speed (12.7s → 0.1s on repeat).
- **Relevance ranking by notability** — Wikipedia presence + historic/tourism/
  place tags; drops benches & bus stops (replaces hardcoded score).
- **Heading-up map** — map rotates so travel direction is screen-up while
  moving (north-up when stopped).
- **Single play control** — one primary Play/Pause/Resume + a labelled
  "tap to play" list (was two competing play affordances).
- **Wider auto-trigger at speed** — up to 4 km so rural roadside landmarks
  fire; client-side discovery time-throttle (8s) as backstop.
