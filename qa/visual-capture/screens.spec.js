// Captures a screenshot of each screen for the agentic review to analyse.
// Not a pass/fail test — it just produces images. Backend is mocked (via the
// shared fixtures) so the captures are deterministic and free.
import { test } from '../../tests/e2e/fixtures.js';

const SCREENS = [
  { name: 'journey', url: '/' },
  { name: 'preferences', url: '/?screen=prefs' },
  { name: 'planner', url: '/?screen=planner' },
];

for (const screen of SCREENS) {
  test(`capture ${screen.name}`, async ({ page }, testInfo) => {
    await page.goto(screen.url);
    // Let the mocked data render and any entry animation settle.
    await page.waitForTimeout(800);
    const project = testInfo.project.name; // phone | desktop
    await page.screenshot({
      path: `qa/reports/_shots/${screen.name}-${project}.png`,
      fullPage: true,
    });
  });
}
