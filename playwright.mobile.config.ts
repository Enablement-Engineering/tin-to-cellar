import base from './playwright.theme.config'

export default {
  ...base,
  testMatch: '**/workspace-mobile.pw.ts',
  webServer: {
    command: 'npm run preview:frontend -- --host 127.0.0.1 --port 43935 --strictPort',
    url: 'http://127.0.0.1:43935', reuseExistingServer: false,
  },
  projects: base.projects?.filter(project => ['iphone-webkit', 'mobile-chromium'].includes(project.name!)),
}
