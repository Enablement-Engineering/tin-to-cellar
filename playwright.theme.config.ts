import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: ['**/theme.pw.ts', '**/theme-touch.pw.ts'],
  workers: 2,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:43935', trace: 'retain-on-failure' },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'desktop-webkit', use: { browserName: 'webkit' } },
    { name: 'desktop-chromium', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } },
  ],
  webServer: {
    command: 'npm run dev:frontend -- --host 127.0.0.1 --port 43935 --strictPort',
    url: 'http://127.0.0.1:43935', reuseExistingServer: false,
  },
})
