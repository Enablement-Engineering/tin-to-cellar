import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/gallery', testMatch: '**/*.pw.ts', workers: 1,
  timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:43928', browserName: 'chromium', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'npm run gallery:test:server', url: 'http://127.0.0.1:43928/api/gallery/v1/config', reuseExistingServer: false, timeout: 120000 },
})
