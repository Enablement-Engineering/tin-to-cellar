// @vitest-environment node
import { expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { encode } from 'fast-png'
import { createHash } from 'node:crypto'
import { previewUpdate } from './prepare-image-previews.mjs'

it('backfills only the same published thumbnail, once, without changing its bytes or hash', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const image = encode({ width: 320, height: 320, channels: 4, data: new Uint8Array(320 * 320 * 4) })
  const hash = createHash('sha256').update(image).digest('hex')
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE gallery_assets(submission_id,kind,sha256,preview_data_url); CREATE TABLE gallery_submissions(id,state);')
  db.prepare('INSERT INTO gallery_assets VALUES(?,?,?,NULL)').run(id, 'thumbnail', 'newer-hash')
  db.prepare('INSERT INTO gallery_submissions VALUES(?,?)').run(id, 'published')
  const sql = previewUpdate(id, image)
  expect(db.prepare(sql).run().changes).toBe(0)
  db.prepare('UPDATE gallery_assets SET sha256=?').run(hash)
  db.exec("UPDATE gallery_submissions SET state='unpublished'")
  expect(db.prepare(sql).run().changes).toBe(0)
  db.exec("UPDATE gallery_submissions SET state='published'")
  expect(db.prepare(sql).run().changes).toBe(1)
  expect(db.prepare(sql).run().changes).toBe(0)
  expect(db.prepare('SELECT sha256 FROM gallery_assets').get().sha256).toBe(hash)
  db.close()
})
