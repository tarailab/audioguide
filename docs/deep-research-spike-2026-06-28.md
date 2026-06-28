# Deep-research spike — northern Spain (2026-06-28)

Evaluating the "deep research track" (see BACKLOG → 🔬 Deep-research dossiers).
Ran the `deep-research` harness on 5 northern-Spain places to judge angle
quality, local-language lift, hallucination risk, and cost **before** building
the production pipeline.

**Method:** fan-out web search (5 angles) → fetch 26 sources → extract 114
claims → 3-vote adversarial verification on the top 25 → synthesis.
**Cost:** 108 agents · ~3.35M tokens (~670K/place) · ~16 min · 26 sources ·
18 claims confirmed / 7 killed / 8 after synthesis.

---

## Per-place dossiers (verified findings only)

### Getaria (Gipuzkoa) — richest yield
- **Juan Sebastián Elcano** (1487–1526), first to circumnavigate the globe; took
  command after Magellan's death, returned on the *Victoria* (Sep 1522). Town
  stages a *Desembarco de Elkano* reenactment every 4 years. *(high)*
- **Cristóbal Balenciaga** born here 21 Jan 1895; Balenciaga Museum opened in
  Aldamar Park 7 Jun 2011 (Basque Govt primary source). *(high)*
- **Restaurante Elkano** traces its charcoal-grill tradition to the iron grills
  of 16th-c. transoceanic expeditions — anchored by Elcano's 1526 will listing
  "tres parrillas de fierro"; "World Reference for Turbot", Michelin, #16 World's
  50 Best. *(high; literal grill continuity is partly lore)*

### Olite (Navarre)
- **Royal Palace** expanded into monumental form by **Carlos III "the Noble"**
  (c.1402–1424); court of banquets, tournaments, exotic animals (lions, camel,
  giraffe), hanging gardens, library — "exotismo y vanguardia", water as the
  organizing design element. *(high)*
- **Deliberately burned Feb 1813** by guerrilla leader **Espoz y Mina** in the
  Peninsular War — anchored by his own *parte de guerra* (16 Feb 1813). *(high;
  the "prevent French fortification" MOTIVE is contested — act/date/actor solid)*

### Lugo (Galicia)
- **Roman wall**: 2,266 m, 33.4 ha enclosed, 85–86 towers (46 intact), 10 gates
  (5 original Roman); UNESCO WHS #987 (30 Nov 2000, criterion iv). *(high)*
- ⚠️ The founding claim ("Lucus Augusti, 13 BC … wall built late 3rd c. AD") was
  **refuted 0-3** by the harness — but this is standard history; likely a
  false-negative (thin corroboration in the fetched set). Re-verify.

### Santillana del Mar (Cantabria)
- **Name from Santa Juliana** (SANCTA IULIANA); relics → monastery (~870) →
  Romanesque Colegiata (12th c.), now a catalogued component (UNESCO 669bis-012)
  of the **Camino del Norte**. "Villa de las tres mentiras" (neither holy, flat,
  nor by the sea; "del Mar" added 1822). *(high)*
- **Marqués de Santillana** title first granted 1445 to the poet **Íñigo López de
  Mendoza** via the Crown's rights in the Asturias de Santillana. *(high)*

### Besalú (Girona) — FAILED
- **Zero surviving claims.** All Jewish-heritage claims (the *call*, synagogue,
  12th-c. mikveh, "500+ years of Jewish habitation") were refuted or split
  (0-3, 1-2). Besalú's primary draw IS its Jewish heritage — yet the harness
  produced nothing verified. Almost certainly false-negatives from weak/thin
  sourcing; needs a dedicated re-research pass with scholarly primary sources.

---

## Refuted / killed (note: several are likely TRUE — verifier recall issue)

| Claim | Vote | Note |
|---|---|---|
| Elcano born Getaria 1487, died 6 Aug 1526 | 0-3 | Fact is TRUE; one source's phrasing judged |
| Balenciaga born 21 Jan 1895, died 1972 Jávea | 0-3 | Fact is TRUE; over-corroborated elsewhere |
| Getaria charter 1 Sep 1209 (Alfonso VIII) | 0-3 | Unverified |
| Besalú Jewish quarter 500+ years | 1-2 | Likely true; thin sourcing |
| Besalú call + synagogue + mikveh triad | 0-3 | Mikveh is genuinely famous — false-negative |
| Lugo founded Lucus Augusti 13 BC | 0-3 | Standard history — false-negative |
| Racing Santander founded 1913 | 1-2 | Likely true; thin sourcing |

---

## Themed-trip anchors (from verified set)
- **Maritime / Age of Discovery** — Getaria (Elcano) ⭐, + Elkano grill lineage.
- **Camino / religious** — Santillana del Mar (Colegiata on Camino del Norte).
- **Medieval royal / military** — Olite (Carlos III + 1813 burning), Lugo (Roman wall).
- **Food/wine** — Getaria (Elkano, turbot).
- ❌ No verified anchors for: **criminal/outlaw Spain**, **football Spain**,
  **modernist architecture** — need targeted research.

## Cross-place connection graph (sparse)
- Santillana del Mar → Íñigo López de Mendoza (1st Marqués de Santillana, poet) —
  via the Asturias de Santillana territory.
- Getaria → Elcano → global circumnavigation; Elcano → Sancti Petri/Cádiz (via
  the Cataria restaurant framing).
- ⚠️ **No person/event links found BETWEEN the five towns** — narrative routing
  between these specific POIs isn't supported by the verified set.

---

## Spike assessment → production implications

1. **Concept validated** where documentation exists (Getaria/Olite/Lugo/
   Santillana): genuinely non-obvious, locally-sourced, guide-grade angles.
2. **Local-language sourcing adds value** — but official local sources are NOT
   automatically reliable (getariaturismo.eus refuted 0-3 on true facts).
3. **Yield varies wildly** — Getaria 9 claims, Besalú 0. Need a graceful
   "limited material" state per place.
4. **Verification needs recalibration toward RECALL** — it killed true,
   well-known facts (Lugo founding, Besalú mikveh). Use source-trust tiers +
   a "needs review" bucket instead of hard-kill.
5. **Too heavy/expensive as-is** (~670K tokens/place) for full coverage →
   must be **demand-gated by the planner's "research" mark**, lazy, and run on a
   lighter pipeline (Ollama extraction, Claude synthesis only).

**Recommendation:** build it — demand-gated, lighter pipeline, recall-friendly
verification, and an **owner curation/review step** for the angle-finding (where
both the magic and the hallucination risk live). Not an autonomous full-coverage
crawler.
