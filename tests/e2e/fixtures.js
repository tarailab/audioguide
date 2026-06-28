// Shared test setup: a fake GPS position and a fully mocked backend.
//
// WHY MOCK: the real backend calls Claude/OpenAI/Ollama and live POI services.
// Letting UI tests hit those would be slow, flaky, expensive, and would burn
// GPU/API budget on every run. Instead we intercept every /api/* request in the
// browser and return canned responses, so each test exercises the REAL UI code
// against predictable data. Integration with the live backend is covered
// separately by the scheduled agentic review, not by these fast gates.

import { test as base, expect } from '@playwright/test';

// Vilnius Old Town — somewhere with plenty of POIs.
export const FAKE_POSITION = { latitude: 54.6872, longitude: 25.2797 };

const SAMPLE_PLACES = [
  {
    id: 'poi-1',
    name: 'Gediminas Tower',
    distance: 220,
    bearing: 'NE',
    tier: 'A',
    relevanceScore: 0.92,
    lat: 54.6869,
    lon: 25.2906,
  },
  {
    id: 'poi-2',
    name: 'Vilnius Cathedral',
    distance: 410,
    bearing: 'N',
    tier: 'A',
    relevanceScore: 0.88,
    lat: 54.6858,
    lon: 25.2876,
  },
];

const SAMPLE_STORY = {
  text: 'Gediminas Tower has crowned this hill since the 14th century, the last '
    + 'standing piece of the Upper Castle that once guarded medieval Vilnius.',
  poi: SAMPLE_PLACES[0],
};

// Register canned responses for every backend route the UI can call.
async function mockBackend(page) {
  await page.route('**/api/pois', (route) =>
    route.fulfill({ json: { places: SAMPLE_PLACES, area: { radius: 800 } } }));

  await page.route('**/api/pois/browse', (route) =>
    route.fulfill({ json: { places: SAMPLE_PLACES, capped: false } }));

  await page.route('**/api/pois/enrich', (route) =>
    route.fulfill({ json: SAMPLE_PLACES[0] }));

  await page.route('**/api/story', (route) =>
    route.fulfill({ json: SAMPLE_STORY }));

  // The backend returns { trips: [...] }, NOT a bare array. Returning the wrong
  // shape here made TripPlanner destructure `undefined` and crash to a blank
  // screen — a test-only failure that does not exist in the real app.
  await page.route('**/api/trips', (route) =>
    route.fulfill({ json: { trips: [] } }));

  // Active-trip fetch / create return { trip: {...} } — mock for robustness.
  await page.route('**/api/trips/**', (route) =>
    route.fulfill({ json: { trip: { id: 't1', name: 'Test trip', items: [] } } }));

  await page.route('**/health', (route) =>
    route.fulfill({ json: { ok: true } }));
}

// A `test` with geolocation granted, a fake position, and the backend mocked.
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(FAKE_POSITION);
    await use(context);
  },
  page: async ({ page }, use) => {
    await mockBackend(page);
    await use(page);
  },
});

export { expect, SAMPLE_PLACES, SAMPLE_STORY };
