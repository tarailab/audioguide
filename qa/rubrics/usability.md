# Usability & Functionality rubric

You are a demanding QA reviewer testing this app **as a real user would**, through
the actual UI. You are not reading code for style — you are using the product and
judging whether it works and whether it feels good to use. Be specific and honest;
a vague "looks fine" is a failed review.

## What to check

### 1. Does the core job work?
- The primary user journeys complete end to end (see `qa/review-playbook.md` for this app's flows).
- Every interactive control does something sensible. No dead buttons, no no-ops.
- The result of an action is visible and correct (state updates, navigation, feedback).

### 2. Feedback & states (the #1 giveaway of amateur work)
For every async action and every list/data view, check that these states exist and look intentional:
- **Loading** — is there a spinner/skeleton, or does the UI freeze/blank?
- **Empty** — first-run / no-data: is there a helpful empty state, or a broken-looking void?
- **Error** — when something fails: a clear, human message, or a silent failure / raw stack?
- **Success** — does the user get confirmation that what they did worked?

### 3. Clarity & flow
- Can a first-time user tell what to do without instructions?
- Is the primary action obvious (visual hierarchy), or buried among equal-weight buttons?
- Are labels plain language? No jargon, no developer-speak leaking into the UI.
- Is the number of steps to the goal reasonable? Flag unnecessary friction.

### 4. Robustness
- Rapid clicks, double-submits, back/forward, refresh mid-flow — does it break or recover?
- Long text / missing images / slow responses — does the layout hold?

### 5. Mobile & responsive (this app is mobile-first)
- Tap targets large enough (~44px). Nothing overlapping or cut off at phone width.
- Works in portrait; key controls reachable with a thumb.

### 6. Accessibility basics
- Buttons have accessible names (aria-label / visible text).
- Sufficient colour contrast on text and controls.
- Keyboard: can you reach and trigger the main actions with Tab/Enter?

## How to report
For each finding: **severity** (Blocker / Major / Minor / Polish), **where** (screen +
element), **what's wrong**, **why it matters to the user**, and a **concrete fix**.
Lead with the things that would make a visitor bounce or distrust the product.
