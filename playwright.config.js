import { defineConfig, devices } from '@playwright/test';

// UI tests drive the REAL browser against the Vite dev server. The backend is
// mocked at the network layer (see tests/e2e/fixtures.js), so these tests are
// deterministic, fast, and cost nothing — no Anthropic/OpenAI calls, no GPU,
// no live POI services. That's why they're safe to run on every push.
export default defineConfig({
  testDir: './tests/e2e',
  // Fail the build if someone leaves a stray test.only in CI.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',   // full step-by-step trace when a test fails
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Audioguide is a mobile-first PWA — test it at a phone viewport by default.
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  // Auto-start the frontend dev server for the test run (reuse it if already up).
  webServer: {
    command: 'npm run dev --prefix frontend',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
