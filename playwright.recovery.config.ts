import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/recovery',
  testMatch: '**/*.pw.ts',
  workers: 1,
  timeout: 30000,
  use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome', trace: 'retain-on-failure' },
})
