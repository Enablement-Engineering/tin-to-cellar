import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/usage-resilience', testMatch: '**/*.pw.ts', workers: 1, timeout: 60000,
  outputDir: './test-results/usage-resilience',
  use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'development', use: { baseURL: 'http://127.0.0.1:43942' } },
    { name: 'built', use: { baseURL: 'http://127.0.0.1:43943' } },
  ],
  webServer: [
    { command: 'npm exec -- vite --host 127.0.0.1 --port 43942 --strictPort', url: 'http://127.0.0.1:43942', reuseExistingServer: false },
    { command: 'npm exec -- node scripts/usage-resilience-server.mjs', url: 'http://127.0.0.1:43943', reuseExistingServer: false, timeout: 120000 },
  ],
})
