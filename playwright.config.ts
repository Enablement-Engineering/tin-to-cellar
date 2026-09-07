import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:43927', browserName: 'chromium', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'npm run diagnostics:migrate:local && npm run dev -- --ip 127.0.0.1 --port 43927 --inspector-port 0', url: 'http://127.0.0.1:43927', reuseExistingServer: false },
})
