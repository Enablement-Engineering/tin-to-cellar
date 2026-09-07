import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { protocolHtml } from './protocol-html.mjs'
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const write = (path, value) => writeFile(new URL(`../${path}`, import.meta.url), value)
const hash = (text) => createHash('sha256').update(text).digest('hex')
const registry = JSON.parse(await read('src/lib/protocol/releases.json'))
const revision = registry.current
if (typeof revision !== 'string' || !/^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/.test(revision)) throw new Error('Current protocol version must use major.minor.patch')
const manifest = await read('src/lib/cellarpack/cellarpack-v1.schema.json')
const feedback = await read('src/lib/feedback/schema.json')
const localProof = await read('src/lib/prompt/local-proof.py')
if (localProof !== localProof.trim() + '\n') throw new Error('Proof source must have exactly one trailing LF')
const protocol = (await read('src/lib/prompt/protocol.md')).replace('<!-- LOCAL_PROOF_SCRIPT -->', `Canonical local-proof.py SHA-256: ${hash(localProof)}\n\n\`\`\`python\n${localProof.trim()}\n\`\`\``)
const feedbackInstructions = await read('src/lib/prompt/feedback.md')
const instructions = `# Tin to Cellar technical instructions\n\nProtocol version: ${revision}\nCellarPack version: 0.1.0\nFeedback version: 0.2.0\nThe complete protocol, both JSON schemas and canonical proof program are included below. Use this revision throughout this run and repairs. Do not fetch protocol instructions or schemas. Record manifest.extensions["tin-to-cellar:protocol"] as {"revision":"${revision}","cellarpackVersion":"0.1.0","feedbackVersion":"0.2.0"}.\n\n${protocol.trim()}\n\n# Complete CellarPack 0.1 JSON Schema\n\n\`\`\`json\n${JSON.stringify(JSON.parse(manifest))}\n\`\`\`\n\n${feedbackInstructions.trim()}\n\n# Complete feedback JSON Schema\n\n\`\`\`json\n${JSON.stringify(JSON.parse(feedback))}\n\`\`\`\n\nEND TIN TO CELLAR PROTOCOL ${revision}\n`
const retrospective = await read('src/lib/feedback/retrospective.schema.json')
const retrospectiveInstructions = await read('src/lib/prompt/retrospective.md')
const completeInstructions = instructions.replace('both JSON schemas', 'all JSON schemas').replace(`END TIN TO CELLAR PROTOCOL ${revision}`, `${retrospectiveInstructions.trim()}\n\n# Complete retrospective JSON Schema\n\n\`\`\`json\n${JSON.stringify(JSON.parse(retrospective))}\n\`\`\`\n\nEND TIN TO CELLAR PROTOCOL ${revision}`)
const files = { 'instructions.md': completeInstructions, 'instructions.html': protocolHtml(completeInstructions, revision), 'cellarpack.schema.json': manifest, 'feedback.schema.json': feedback, 'retrospective.schema.json': retrospective }
for (const release of Object.values(registry.releases)) {
  for (const [name, content] of Object.entries(release.files)) {
    if (hash(content) !== release.hashes[name]) throw new Error(`Historical release ${release.revision}/${name} hash mismatch`)
  }
}
if (process.argv.includes('--create')) {
  if (registry.releases[revision]) throw new Error('Revision already exists; advance current before creating another immutable release')
  registry.releases[revision] = { revision, cellarpackVersion: '0.1.0', feedbackVersion: '0.2.0', files, hashes: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, hash(content)])) }
  await write('src/lib/protocol/releases.json', JSON.stringify(registry, null, 2) + '\n')
  await write('public/agent/tin-to-cellar-prompt.md', completeInstructions)
} else {
  if (!registry.releases[revision]) throw new Error('Create the release first with npm run protocol:release -- --create')
  for (const [name, content] of Object.entries(files)) {
    if (registry.releases[revision].files[name] !== content) throw new Error(`Canonical source differs from immutable release ${revision}/${name}; create a new revision`)
  }
  if (await read('public/agent/tin-to-cellar-prompt.md') !== completeInstructions) throw new Error('Portable public instructions differ from selected release')
}
const metadata = JSON.stringify({ current: registry.current, revisions: Object.keys(registry.releases) }, null, 2) + '\n'
if (process.argv.includes('--create') || process.argv.includes('--refresh-metadata')) {
  await write('src/lib/protocol/metadata.json', metadata)
} else if (await read('src/lib/protocol/metadata.json') !== metadata) {
  throw new Error('Protocol metadata differs from immutable releases; run npm run protocol:release -- --refresh-metadata')
}
console.log(`Protocol release ${revision} verified`)
