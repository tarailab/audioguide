// Preferences: changing a setting through the UI actually takes effect AND
// survives a reload (it's persisted to localStorage). This is a real
// regression magnet — exactly the kind of thing to lock down with a UI test.
import { test, expect } from './fixtures.js';

test('selecting a language persists across reload', async ({ page }) => {
  await page.goto('/?screen=prefs');

  const lithuanian = page.getByRole('button', { name: /Lithuanian/ });
  await lithuanian.click();
  await expect(lithuanian).toHaveClass(/active/);

  // Reload — the choice must still be active (proves it was saved, not just in memory).
  await page.reload();
  await expect(page.getByRole('button', { name: /Lithuanian/ })).toHaveClass(/active/);
});

test('toggling an interest pill updates its state', async ({ page }) => {
  await page.goto('/?screen=prefs');

  // Pick the first interest pill and confirm it toggles on, then off.
  const firstPill = page.locator('.pill-toggle').first();
  const wasActive = await firstPill.evaluate((el) => el.classList.contains('active'));

  await firstPill.click();
  if (wasActive) {
    await expect(firstPill).not.toHaveClass(/active/);
  } else {
    await expect(firstPill).toHaveClass(/active/);
  }
});

test('story engine selection is single-choice', async ({ page }) => {
  await page.goto('/?screen=prefs');

  const local = page.getByRole('button', { name: 'Local (free)' });
  await local.click();
  await expect(local).toHaveClass(/active/);

  // Picking another engine deselects the first (mutually exclusive group).
  const claude = page.getByRole('button', { name: 'Claude (best)' });
  await claude.click();
  await expect(claude).toHaveClass(/active/);
  await expect(local).not.toHaveClass(/active/);
});
