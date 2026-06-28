// Navigation: the three screens are reachable through the UI and via URL,
// and the URL stays in sync (so screens are linkable/refreshable).
import { test, expect } from './fixtures.js';

test('gear button opens Preferences, back returns to journey', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Preferences' }).click();

  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();
  await expect(page).toHaveURL(/screen=prefs/);

  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByRole('button', { name: 'Preferences' })).toBeVisible();
});

test('trip planner is reachable from the journey HUD', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trip planner' }).click();
  await expect(page).toHaveURL(/screen=planner/);
});

test('deep link ?screen=prefs opens Preferences directly', async ({ page }) => {
  await page.goto('/?screen=prefs');
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();
});
