import { defineConfig, devices } from '@playwright/test';

// Dedicated Playwright config for the agentic review's screenshot capture.
// It drives the real app (backend mocked) and writes PNGs of every screen at
// phone + desktop widths into qa/reports/_shots/, which the review agent then
// visually analyses against the rubrics. Kept separate from the main test
// config so capture never runs as part of the pass/fail gate.
export default defineConfig({
  testDir: './visual-capture',
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev --prefix frontend',
    url: 'http://localhost:5173',
    cwd: '..', // config lives in qa/; run the dev server from the repo root
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
