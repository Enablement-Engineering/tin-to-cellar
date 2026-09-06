import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const base = process.env.PROTOCOL_BASE_SHA || process.argv[2]
if (!base || /^0+$/.test(base)) {
  console.log('No prior commit supplied; canonical release hashes are checked by the build.')
} else {
  if (!/^[a-f0-9]{40}$/.test(base)) throw new Error('Expected a full base commit SHA')
  const previous = JSON.parse(execFileSync('git', ['show', `${base}:src/lib/protocol/releases.json`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }))
  const current = JSON.parse(readFileSync('src/lib/protocol/releases.json', 'utf8'))
  for (const [revision, release] of Object.entries(previous.releases)) if (JSON.stringify(current.releases[revision]) !== JSON.stringify(release)) throw new Error(`Historical release ${revision} was modified or removed`)
  console.log(`${Object.keys(previous.releases).length} historical releases unchanged.`)
}
