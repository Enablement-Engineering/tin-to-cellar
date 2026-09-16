import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/usage', testMatch: '**/*.pw.ts', workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:43931', browserName: 'chromium', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'npm run gallery:test:server -- --port 43931', url: 'http://127.0.0.1:43931/api/analytics/v2/config', reuseExistingServer: false, timeout: 120000 },
})
