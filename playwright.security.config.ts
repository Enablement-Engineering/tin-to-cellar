import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/security', testMatch: '**/*.pw.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:43929', browserName: 'chromium', channel: 'chrome' },
  reporter: 'list',
  webServer: {
    command: 'npx wrangler dev --local --port 43929 --inspector-port 0',
    url: 'http://127.0.0.1:43929/api/health', reuseExistingServer: false, timeout: 120000,
  },
})
