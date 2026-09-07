import { describe, expect, it } from 'vitest'
import { importCellarPack } from './importer'
import { makeCellarPack } from './test-fixtures'

const profile = {
  format: 'tin-to-cellar/sheet-profile', schemaVersion: '1.0.0', id: 'custom:test@1',
  name: 'Test sheet', kind: 'fixed-slots', page: { width: 8.5, height: 11, unit: 'in' },
  slots: [{ x: 0.5, y: 0.5, width: 2, height: 2, shape: 'circle' }],
  calibration: { xOffset: 0, yOffset: 0, scale: 1 },
}

async function importProfile(text: string) {
  return importCellarPack(await makeCellarPack({
    mutateManifest: manifest => { manifest.customSheetProfiles = [{ id: profile.id, path: 'sheet-profiles/test.json' }] },
    extraEntries: [{ path: 'sheet-profiles/test.json', data: text }],
  }))
}

describe('custom profile artifact boundary', () => {
  it('accepts a valid custom profile', async () => {
    expect((await importProfile(JSON.stringify(profile))).customSheetProfiles).toEqual([profile])
  })

  it.each([
    JSON.stringify(profile).replace('"name":', '"name":"duplicate","name":'),
    JSON.stringify(profile).replace(/}$/, ',"extra":' + '['.repeat(33) + '0' + ']'.repeat(33) + '}'),
  ])('omits unsafe profile JSON while preserving valid labels', async text => {
    const result = await importProfile(text)
    expect(result.labels).toHaveLength(1)
    expect(result.customSheetProfiles).toEqual([])
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'INVALID_SHEET_PROFILE', severity: 'warning' }))
  })
})
