// Visual regression: catch unintended layout/styling changes. Playwright
// screenshots the page and diffs it against a committed baseline; the test
// fails if pixels drift beyond the threshold.
//
// We snapshot the Preferences screen (stable, no live map tiles). The journey
// map is intentionally NOT snapshotted — Leaflet tiles vary and would flake.
//
// First run / intentional UI change: regenerate baselines with
//   npm run test:ui -- --update-snapshots
import { test, expect } from './fixtures.js';

// Tagged @visual so CI (Linux) can skip it — pixel baselines are OS-specific.
// Visual regression runs locally on Windows, where the baseline matches.
test('preferences screen matches visual baseline @visual', async ({ page }) => {
  await page.goto('/?screen=prefs');
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();

  await expect(page).toHaveScreenshot('preferences.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02, // tolerate sub-2% noise (font hinting, etc.)
  });
});
