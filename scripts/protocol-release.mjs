import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { protocolHtml } from './protocol-html.mjs'
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const write = (path, value) => writeFile(new URL(`../${path}`, import.meta.url), value)
const hash = (text) => createHash('sha256').update(text).digest('hex')
const registry = JSON.parse(await read('src/lib/protocol/releases.json'))
const revision = registry.current
const base = `https://tintocellar.com/api/protocol/v1/releases/${revision}`
const manifest = await read('src/lib/cellarpack/cellarpack-v1.schema.json')
const feedback = await read('src/lib/feedback/schema.json')
const protocol = await read('src/lib/prompt/protocol.md')
const feedbackInstructions = await read('src/lib/prompt/feedback.md')
const instructions = `# Tin to Cellar technical instructions\n\nProtocol revision: ${revision}\nCellarPack version: 1.0.0\nFeedback version: 2.0.0\nCanonical immutable instructions: ${base}/instructions.md\nManifest JSON schema: ${base}/cellarpack.schema.json\nFeedback JSON schema: ${base}/feedback.schema.json\n\nUse this complete release throughout this run and repairs. Do not fetch current again midrun. The schemas below are complete; no additional schema fetch is required. Record manifest.extensions["tin-to-cellar:protocol"] as {"revision":${revision},"cellarpackVersion":"1.0.0","feedbackVersion":"2.0.0"}.\n\n${protocol.trim()}\n\n# Complete CellarPack v1 JSON Schema\n\n\`\`\`json\n${JSON.stringify(JSON.parse(manifest))}\n\`\`\`\n\n${feedbackInstructions.trim()}\n\n# Complete feedback JSON Schema\n\n\`\`\`json\n${JSON.stringify(JSON.parse(feedback))}\n\`\`\`\n\nEND TIN TO CELLAR PROTOCOL ${revision}\n`
const files = { 'instructions.md': instructions, 'instructions.html': protocolHtml(instructions, revision), 'cellarpack.schema.json': manifest, 'feedback.schema.json': feedback }
for (const release of Object.values(registry.releases)) {
  for (const [name, content] of Object.entries(release.files)) {
    if (hash(content) !== release.hashes[name]) throw new Error(`Historical release ${release.revision}/${name} hash mismatch`)
  }
}
if (process.argv.includes('--create')) {
  if (registry.releases[revision]) throw new Error('Revision already exists; advance current before creating another immutable release')
  registry.releases[revision] = { revision, cellarpackVersion: '1.0.0', feedbackVersion: '2.0.0', files, hashes: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, hash(content)])) }
  await write('src/lib/protocol/releases.json', JSON.stringify(registry, null, 2) + '\n')
  await write('public/agent/tin-to-cellar-prompt.md', instructions)
} else {
  if (!registry.releases[revision]) throw new Error('Create the release first with npm run protocol:release -- --create')
  for (const [name, content] of Object.entries(files)) {
    if (registry.releases[revision].files[name] !== content) throw new Error(`Canonical source differs from immutable release ${revision}/${name}; create a new revision`)
  }
  if (await read('public/agent/tin-to-cellar-prompt.md') !== instructions) throw new Error('Portable public instructions differ from selected release')
}
console.log(`Protocol release ${revision} verified`)
