import { defineConfig, devices } from '@playwright/test';

const port = 8799;
const kitPort = 8798;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // The demo specs run in Chromium. The editorial kit runs in Chromium and Firefox,
  // the helpers and paste handling are where browsers differ. See the issue about other browsers.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: /kit\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `php -d error_reporting=E_ALL -d display_errors=0 -S 127.0.0.1:${port} -t demo/public demo/public/router.php`,
      url: `http://127.0.0.1:${port}/`,
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
    {
      command: `node e2e/serve-static.mjs examples/editorial-kit/dist-page ${kitPort}`,
      url: `http://127.0.0.1:${kitPort}/`,
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
    },
  ],
});
