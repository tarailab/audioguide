// Smoke: the app boots and renders its shell without console errors.
// If this fails, something is fundamentally broken — fix before anything else.
import { test, expect } from './fixtures.js';

test('app loads the journey screen and core controls', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');

  // The settings gear and trip-planner buttons are always present on the journey HUD.
  await expect(page.getByRole('button', { name: 'Preferences' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trip planner' })).toBeVisible();

  // No uncaught console errors on load (ignore known-noisy 3rd-party warnings if any).
  expect(consoleErrors, `console errors on load:\n${consoleErrors.join('\n')}`)
    .toHaveLength(0);
});
