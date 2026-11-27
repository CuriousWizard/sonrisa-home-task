import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// No getReadyUrl: when only one server task reports a URL, Nx passes it on, and that can be the API's.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';
const serverStartTimeout = 180_000;
// Applies only to a direct `npx playwright test`. Nx runs the serve command in its own session, out of reach
// of the SIGKILL Playwright sends by default, so Playwright sends SIGTERM and Nx stops it.
const gracefulShutdown = { signal: 'SIGTERM', timeout: 10_000 } as const;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  // The smoke test shares one dev database and mock Slack store, so it runs alone and never retries.
  workers: 1,
  retries: 0,
  // Two 30 second polls plus the UI steps can pass the 30 second default.
  timeout: 90_000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  // Under `npm run e2e`, Nx starts both servers as dependencies of the e2e target, and Playwright reuses them.
  webServer: [
    {
      command: 'npx nx run api:serve',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: serverStartTimeout,
      gracefulShutdown,
    },
    {
      // web:serve proxies /api to the API. web:serve-static has no proxy, so the app cannot reach the API there.
      command: 'npx nx run web:serve',
      url: 'http://localhost:4200',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: serverStartTimeout,
      gracefulShutdown,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
