import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import type { Statement } from '../diagnostics'
import type { GalleryDatabase } from '../gallery/storage'
/** Real SQLite SQL and transactions; only the asynchronous D1 API is adapted. */
export class DB implements GalleryDatabase {
  readonly sql = new DatabaseSync(':memory:')
  calls = 0
  constructor() {
    this.sql.exec('PRAGMA foreign_keys=ON')
    for (const file of ['0001_gallery.sql', '0006_print_intent.sql', '0009_usage_analytics.sql']) this.sql.exec(readFileSync(new URL(`../../migrations/gallery/${file}`, import.meta.url), 'utf8'))
    this.sql.exec("INSERT INTO gallery_tobaccos VALUES('blend-a','Maker','A','[]',1,'test'),('blend-b','Maker','B','[]',1,'test'),('inactive','Maker','Old','[]',0,'test'); INSERT INTO gallery_catalog_aliases VALUES('old-a','blend-a')")
  }
  prepare(sql: string): Statement {
    this.calls++
    let args: unknown[] = []
    const execute = () => ({ meta: { changes: Number(this.sql.prepare(sql).run(...args as never[]).changes) } })
    const statement = {
      bind: (...values: unknown[]) => { args = values; return statement },
      run: async () => execute(),
      first: async <T>() => (this.sql.prepare(sql).get(...args as never[]) ?? null) as T | null,
      all: async <T>() => ({ results: this.sql.prepare(sql).all(...args as never[]) as T[] }),
      execute,
    }
    return statement
  }
  async batch(statements: Statement[]) {
    this.sql.exec('BEGIN')
    try {
      // No yield within a transaction, matching D1's atomic batch behavior.
      const results = statements.map(statement => (statement as Statement & { execute: () => unknown }).execute())
      this.sql.exec('COMMIT')
      return results
    } catch (error) { this.sql.exec('ROLLBACK'); throw error }
  }
}
