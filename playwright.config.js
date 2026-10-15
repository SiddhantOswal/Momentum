import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', fullyParallel: false, workers: 1, retries: 0,
  timeout: 30000, expect: { timeout: 5000 }, reporter: 'list',
  outputDir: '/private/tmp/ustaad-playwright-results',
  use: { baseURL: 'http://127.0.0.1:4182', channel: 'chrome', headless: true, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node index.mjs', url: 'http://127.0.0.1:4182/health', reuseExistingServer: false,
    env: { PORT: '4182', K_SERVICE: '', USTAAD_ENABLE_DEMO_MODE: 'false', USTAAD_ENABLE_LIVE_MODEL_CALLS: 'false', USTAAD_ENABLE_RISK_PREDICTION: 'false', USTAAD_ENABLE_HISTORICAL_EVIDENCE: 'false', USTAAD_ENABLE_IMPACT_SUMMARY: 'false', USTAAD_ENABLE_JOB_STORAGE: 'false', USTAAD_ENABLE_BIGQUERY_WRITES: 'false', USTAAD_ENABLE_FEEDBACK_WRITES: 'false', USTAAD_ENABLE_FIREBASE_AUTH: 'false' } },
});
