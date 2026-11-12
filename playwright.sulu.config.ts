import { defineConfig, devices } from '@playwright/test';

const port = 8899;

/*
 * The admin smoke test against a real Sulu project built by
 * e2e-sulu/setup.sh. Kept apart from playwright.config.ts: it needs the
 * project and a database, which the other tests do not.
 */
export default defineConfig({
  testDir: './e2e-sulu',
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  timeout: 90_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `php -d error_reporting=E_ALL -d display_errors=0 -S 127.0.0.1:${port} -t public public/router.php`,
    cwd: '.sulu-app',
    url: `http://127.0.0.1:${port}/admin`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
