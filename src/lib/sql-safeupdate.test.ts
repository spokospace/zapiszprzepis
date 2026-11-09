import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// PostgREST sessions on Supabase preload pg_safeupdate, which rejects an UPDATE or DELETE
// without a WHERE clause (SQLSTATE 21000). Direct SQL (Management API, migrations) does not
// load it, so such a statement passes every migration check and only fails in production,
// for every request that reaches it: #722's content_version trigger broke all recipe writes
// through the API this way (fixed in 20261109100000). This pins the rule on the latest
// definition of every function in the migrations.
const DIR = join(process.cwd(), 'supabase/migrations')

/** function name -> body of its last `create [or replace] function` across the migrations. */
function latestFunctionBodies(): Map<string, string> {
  const bodies = new Map<string, string>()
  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
  const fn = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?(\w+)"?\s*\([\s\S]*?\bas\s+(\$\w*\$)([\s\S]*?)\2/gi
  for (const file of files) {
    const sql = readFileSync(join(DIR, file), 'utf8')
    for (const m of sql.matchAll(fn)) bodies.set(m[1].toLowerCase(), m[3])
  }
  return bodies
}

/** UPDATE / DELETE statements of a function body that have no WHERE. */
function unguardedWrites(body: string): string[] {
  const code = body.replace(/--[^\n]*/g, '')
  return code
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => /\b(update\s+[\w."]+(\s+(as\s+)?\w+)?\s+set|delete\s+from)\b/i.test(s))
    .filter((s) => !/\bon\s+conflict\b/i.test(s)) // `insert ... on conflict do update set` is per row
    .filter((s) => !/\bwhere\b/i.test(s))
}

describe('pg_safeupdate: every UPDATE / DELETE in a function has a WHERE', () => {
  const bodies = latestFunctionBodies()

  it('finds the functions', () => {
    expect(bodies.size).toBeGreaterThan(20)
    expect(bodies.has('bump_recipe_content_version')).toBe(true)
  })

  it('no function writes without WHERE', () => {
    const offenders = [...bodies].flatMap(([name, body]) => unguardedWrites(body).map((s) => `${name}: ${s}`))
    expect(offenders).toEqual([])
  })

  it('catches the #722 statement', () => {
    expect(unguardedWrites('update public.recipe_files_state set content_version = content_version + 1;')).toHaveLength(1)
    expect(unguardedWrites('update public.recipe_files_state set content_version = content_version + 1 where id;')).toEqual([])
    expect(unguardedWrites('insert into t (a) values (1) on conflict (a) do update set b = 2;')).toEqual([])
  })
})
