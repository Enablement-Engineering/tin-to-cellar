// Isolated production build with a module-ownership report for blocking tests.
import { build, preview } from 'vite'

const outDir = 'output/usage-resilience'
await build({
  build: { outDir, emptyOutDir: true, manifest: true },
  plugins: [{
    name: 'verify-optional-usage-boundary',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(item => item.type === 'chunk')
      const optional = chunks.filter(chunk => Object.keys(chunk.modules).some(id => id.replaceAll('\\', '/').includes('/src/lib/analytics/')))
      const runtime = optional.find(chunk => Object.keys(chunk.modules).some(id => id.endsWith('/src/lib/analytics/runtime.ts')))
      if (!runtime?.isDynamicEntry) throw Error('Usage runtime must be a dynamic entry')
      const initial = new Set()
      const visit = file => {
        if (initial.has(file)) return
        initial.add(file)
        for (const dependency of bundle[file]?.imports ?? []) visit(dependency)
      }
      for (const entry of chunks.filter(chunk => chunk.isEntry)) visit(entry.fileName)
      if (optional.some(chunk => initial.has(chunk.fileName))) throw Error('Analytics leaked into the initial static module graph')
      this.emitFile({ type: 'asset', fileName: 'usage-boundary.json', source: JSON.stringify({ runtime: runtime.fileName, optional: optional.map(chunk => chunk.fileName), initial: [...initial] }) })
    },
  }],
})
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 43943, strictPort: true } })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.httpServer.close(); process.exitCode = 0 })
server.printUrls()
