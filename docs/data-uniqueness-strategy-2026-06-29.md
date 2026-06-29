# Data-uniqueness & acquisition strategy (2026-06-29)

From a deep-research pass (112 agents, 29 sources, adversarial verification) +
synthesis. The moat is **fusion**, not the corpus: merge open sources onto a
Wikidata grounding spine, then run *grounded* cross-POI synthesis. Goal: a dossier
**measurably richer than Wikipedia**.

## The insight that de-risks the merge
The entity-resolution literature is scary (fuzzy name/coord/type matching, O(N²),
SOTA only proven on Chinese-city data). **But we mostly don't need it** — our
target sources already carry **Wikidata QIDs** (Europeana, DBpedia, GeoNames, and
OSM via `wikidata=` tags all link to QID). So merge ≈ a **join on QID**, with
fuzzy name+coordinate matching only as a fallback for QID-less sources (some
registries). The hard ER problem is largely sidestepped because we ground on
Wikidata. *(verified: Wikidata QIDs are the canonical multilingual merge key.)*

## Q1 — Sources to merge (verified first, then promising-unverified)

**Verified (high confidence):**
- **OpenStreetMap / Geofabrik** — daily bulk `.osm.pbf`, **ODbL** (commercial OK; attribution + share-alike), Europe ~32GB. Adds dense geometry + historic/heritage/man_made/memorial tags. **We already run this extract** → zero new infra, do it first. `download.geofabrik.de`
- **Europeana** — **45M+** cultural-heritage items, **metadata CC0**, bulk/OAI-PMH/SPARQL, already interlinked to Wikidata/GeoNames/VIAF → trivial QID merge. Unique angle: the actual *artifacts* (art, museum objects, historical photos) tied to a place. ⚠️ **CC0 is metadata only — media objects carry per-object rights (often restrictive); link out, don't redistribute media.** `pro.europeana.eu/page/apis`
- **Wikivoyage** — **CC BY-SA**, adds travel-narrative/practical content Wikipedia lacks. ⚠️ the "small XML dump" was **refuted** — bulk path needs re-checking. `en.wikivoyage.org`
- **Open Data Euskadi (Basque)** — **CC-BY**, bulk CSV/GeoJSON/KML — confirms the regional-registry pattern works. `opendata.euskadi.eus`
- **Wikidata** — the grounding spine (QIDs/PIDs), not a rich content source (incomplete, ~12.5 facts/entity). Identity base; richness comes from the merged sources.

**Promising but NOT verified (check before relying):**
- Spain **BIC**, Catalonia **IPAC/InvArquit**, Galicia, **Lithuania/Latvia** heritage registries — license/bulk/QID-linkage unconfirmed. (An OSM `ref:ipac` crosswalk to IPAC was **refuted** — don't assume it.)
- Public-domain old **travel literature** (Internet Archive / Gutenberg / HathiTrust) — high unique-angle potential (vivid 19th-c. traveler accounts), bulk paths unverified.
- DBpedia, GeoNames, Wikimedia Commons, Europeana Newspapers, folklore corpora — plausible, unverified here.

## Q2 — Merge + cross-POI synthesis
1. **Merge:** QID-join the QID-bearing sources; fuzzy fallback (name string/phonetic/embedding + type-aware proximity blocking, *not* a fixed radius) only for registries without QIDs. SkyEx/QuadSky is a contradiction-aware non-LLM baseline if needed.
2. **Per-region knowledge graph:** entities = POIs, people, events, motifs; every edge/claim carries its **source span**.
3. **Cross-POI synthesis = grounded hypotheses, not free generation.** This is the #1 risk: peer-reviewed evidence shows LLMs **hallucinate up to 75%** of multi-document summary content and **fabricate rather than abstain 44–79%** of the time. So: every emergent "insight" must cite the source spans it's built from; **no grounding → abstain** (→ our existing `needsReview` bucket); treat each cross-POI connection as a hypothesis run through a verify pass before it enters a dossier. Use spatial/type blocking + group prompting (GER-LLM pattern) to scale.

## Q3 — The "better than Wikipedia" benchmark (designed here; research left it open)
A **Beyond-Wikipedia scorecard** — run on a sample of N POIs, our merged dossier vs the EN-Wikipedia summary:
1. **Net-new verifiable facts** — facts in our dossier absent from EN-Wikipedia, each still source-cited *(core "richer" number)*.
2. **Local-language-only facts** — subset sourced only from non-English.
3. **Cross-source facts** — require ≥2 merged sources.
4. **Cross-POI insights** — count + % verified.
5. **Grounding rate** — sample claims, check against cited source; % grounded *(the trust metric; LLM-judge + spot human check)*.
6. **Blind human preference** — evaluators see Wikipedia vs our dossier unlabeled: "more useful/interesting for a traveler?" → win rate.
This is simultaneously the **€0 spend-gate** and the **marketing evidence** ("X% of facts beyond Wikipedia · N cross-POI insights/town · Y% source-grounded · preferred Z:1 blind").

## Q4 — Competitors / white space (unverified by this pass)
Not confirmed in research; from prior analysis: POI databases (no angles), Atlas Obscura (human-curated unusual), AI planners (live-generate, ungrounded). **White space = local-language + cross-POI synthesis + long-tail completeness, grounded.** Worth a dedicated scan before any B2B pitch.

## Recommended sequence
1. **Benchmark first** (Q3) — cheapest, gates all spend, produces the proof.
2. **Merge OSM** (already have it) → first uniqueness lift, free.
3. **Merge Europeana** (QID-join, metadata-only) → artifacts angle.
4. **Verify + add one registry** (Euskadi confirmed; check Catalonia/BIC/Baltics).
5. **Grounded cross-POI synthesis** with abstention + verify pass.

## Caveats
SOTA ER unproven on European/multilingual/Baltic toponyms (but QID-join sidesteps most of it). Europeana media ≠ CC0. ODbL/CC-BY-SA share-alike obligations are real for a commercial product. Wikivoyage dump + several registries unverified. Competitors/white-space (Q4) and the benchmark (Q3) were not answered by the research — the benchmark above is our design, not a cited finding.
