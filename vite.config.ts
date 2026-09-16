import react from '@vitejs/plugin-react'
import { randomUUID } from 'node:crypto'
import { configDefaults, defineConfig } from 'vitest/config'

const buildId = process.env.BUILD_ID ?? randomUUID()
if (!/^[A-Za-z0-9._-]{1,160}$/.test(buildId)) throw new Error('BUILD_ID must contain 1–160 letters, digits, dots, underscores, or hyphens.')

// https://vite.dev/config/
export default defineConfig({
  // Saved acceptance artifacts can contain old test harnesses with stale imports.
  test: { exclude: [...configDefaults.exclude, 'output/**'] },
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), {
    name: 'app-build-identity',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'app-version.json', source: JSON.stringify({ buildId }) + '\n' })
    },
  }],
})
