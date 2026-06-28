# Design, Architecture & "does this look professional" rubric

The owner is **not** a developer and explicitly does not want the product to look
like amateur "vibe-coded" output. Your job is to catch the tells that make
software look hobbyist, in **both** the visual layer and the code/architecture.
Hold it to the standard of a well-made commercial app.

## A. Visual & design polish (judge from the screenshots)

### Consistency — the biggest professionalism signal
- **Spacing**: is there a consistent rhythm (4/8px scale), or arbitrary gaps?
- **Typography**: a small, deliberate set of sizes/weights — not a dozen random ones.
- **Colour**: a coherent palette with intent. Flag clashing colours, pure-black text,
  default-blue links, unstyled browser defaults.
- **Alignment**: things line up to a grid. Flag ragged edges and off-by-a-few-pixels drift.
- **Components**: buttons/inputs/cards share one style. Flag visual "dialects" — two
  button styles that mean the same thing.

### Specific amateur tells to hunt for
- Default/unstyled form controls and scrollbars.
- Emoji used as load-bearing UI icons where a real icon set is expected.
- Inconsistent border-radius / shadows.
- Text crammed edge-to-edge with no breathing room.
- No visual hierarchy — everything the same size and weight.
- Misaligned or stretched images, no aspect-ratio handling.
- Janky transitions or none where motion is expected.

### Empty / first-run impression
- What does a brand-new user see on first load? Is it inviting or barren/confusing?

## B. Architecture & code health (judge from the diff + a quick read)

- **Separation of concerns**: UI, state, data-fetching, and business logic are not
  tangled in one mega-component. Flag 300+ line components doing everything.
- **Reuse**: repeated UI/logic copy-pasted instead of factored into a component/helper.
- **Naming**: clear, consistent, intention-revealing. Flag `data2`, `tmp`, `handleClick3`.
- **State management**: predictable and minimal; no prop-drilling six levels or
  duplicated sources of truth.
- **Error handling**: failures are caught and surfaced, not swallowed or left to crash.
- **Config & secrets**: no hardcoded URLs/keys; environment-driven.
- **Dead code / TODOs**: flag commented-out blocks and stale TODO/FIXME left in shipping code.
- **Folder structure**: a newcomer could find things. Flag a flat dump of unrelated files.

## C. User flows
- Map the actual flows in the diff. Are there dead ends (a screen with no way back)?
- Is anything reachable only by typing a URL but not via the UI?
- Does the back/navigation model match what a user expects?

## How to report
Prioritise the **3–7 changes with the highest professionalism payoff** first — the
things a visitor would notice in the first 10 seconds. Then list smaller polish items.
Each finding: severity, location, the tell, and the concrete fix (with the design
principle behind it, so the fix generalises).
