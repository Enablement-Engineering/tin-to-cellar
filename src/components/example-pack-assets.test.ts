import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { importCellarPack } from '../lib/cellarpack'

it('imports all ten bundled example labels without quarantining artwork', async () => {
  const bytes = Buffer.concat(['aa', 'ab'].map((part) => readFileSync(`public/examples/ten-blends/pack-${part}`)))
  const result = await importCellarPack(new Uint8Array(bytes).buffer)
  expect(result.issues.filter((issue) => issue.severity === 'error' || issue.severity === 'fatal')).toEqual([])
  expect(result.labels).toHaveLength(10)
  expect(result.quarantinedLabels).toEqual([])
})
