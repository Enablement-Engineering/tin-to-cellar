import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { build } from 'vite'

type Build = 'A' | 'B'
export type ServedRequest = { path: string; status: number; build: Build }

/** Two real production builds with distinct lazy-module hashes, served as successive releases. */
export class ProductionServer {
  origin = ''
  current: Build = 'A'
  retainPrevious = false
  failPrompt = false
  versionUnavailable = false
  advertiseNextAfterReload = false
  holdVersion = false
  versionRequests = 0
  requests: ServedRequest[] = []
  private directory = ''
  private server: Server | undefined
  private versionWaiters: Array<() => void> = []

  async start() {
    this.directory = await mkdtemp(join(tmpdir(), 'tin-to-cellar-recovery-'))
    const previousBuildId = process.env.BUILD_ID
    try {
      for (const id of ['A', 'B'] as const) {
        process.env.BUILD_ID = `recovery-test-${id}`
        await build({
          logLevel: 'error',
          build: { outDir: join(this.directory, id), emptyOutDir: true },
          // A deploy normally changes some code. This fixture changes every chunk's
          // bytes without editing source or depending on any particular chunk graph.
          plugins: [{ name: 'recovery-release-fixture', renderChunk: code => `${code}\n/* recovery release ${id} */` }],
        })
        const marker = JSON.parse(await readFile(join(this.directory, id, 'app-version.json'), 'utf8'))
        if (marker.buildId !== `recovery-test-${id}`) throw new Error(`Build ${id} did not include its expected version marker`)
      }
    } finally {
      if (previousBuildId === undefined) delete process.env.BUILD_ID
      else process.env.BUILD_ID = previousBuildId
    }
    this.server = createServer((request, response) => {
      void (async () => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname
        const finish = (status: number, type: string, body: string | Buffer, servedBuild = this.current) => {
          this.requests.push({ path, status, build: servedBuild })
          response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
          response.end(body)
        }
        if (path === '/app-version.json') {
          this.versionRequests++
          if (this.holdVersion) await new Promise<void>(resolve => this.versionWaiters.push(resolve))
          if (this.versionUnavailable) { finish(503, 'text/plain', 'Unavailable'); return }
          if (this.advertiseNextAfterReload && this.requests.some(item => item.path === '/labels/help' && item.build === 'B' && item.status === 200)) {
            finish(200, 'application/json', JSON.stringify({ buildId: 'recovery-test-C' })); return
          }
          finish(200, 'application/json', await readFile(join(this.directory, this.current, 'app-version.json'))); return
        }
        if (path === '/api/gallery/v1/config') {
          finish(200, 'application/json', JSON.stringify({ intake: false, serving: false })); return
        }
        if (path.startsWith('/api/')) { finish(404, 'application/json', '{}'); return }
        if (this.failPrompt && /\/assets\/prompt-[^/]+\.js$/.test(path)) { finish(404, 'text/plain', 'Missing module'); return }
        const candidates = this.current === 'B' && this.retainPrevious ? ['B', 'A'] as const : [this.current]
        for (const id of candidates) {
          const root = resolve(this.directory, id)
          const file = resolve(root, `.${path}`)
          if (!file.startsWith(`${root}${sep}`)) continue
          try {
            const data = await readFile(file)
            const type = ({ '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' } as Record<string, string>)[extname(path)] ?? 'application/octet-stream'
            finish(200, type, data, id); return
          } catch { /* Try the previous release, then the SPA shell. */ }
        }
        // Never return index.html for a missing script: match the production
        // /assets/* SPA-fallback exclusion and produce an actual module failure.
        if (path.startsWith('/assets/')) { finish(404, 'text/plain', 'Missing asset'); return }
        finish(200, 'text/html', await readFile(join(this.directory, this.current, 'index.html')))
      })().catch(error => { response.writeHead(500); response.end(String(error)) })
    })
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '127.0.0.1', resolve)
    })
    const address = this.server.address()
    if (!address || typeof address === 'string') throw new Error('Recovery fixture server did not start')
    this.origin = `http://127.0.0.1:${address.port}`
  }

  reset() {
    this.releaseVersion()
    this.current = 'A'
    this.retainPrevious = false
    this.failPrompt = false
    this.versionUnavailable = false
    this.advertiseNextAfterReload = false
    this.holdVersion = false
    this.versionRequests = 0
    this.requests = []
  }

  releaseVersion() {
    this.holdVersion = false
    for (const release of this.versionWaiters.splice(0)) release()
  }

  async close() {
    this.releaseVersion()
    if (this.server?.listening) await new Promise<void>((resolve, reject) => this.server!.close(error => error ? reject(error) : resolve()))
    if (this.directory) await rm(this.directory, { recursive: true, force: true })
  }
}
