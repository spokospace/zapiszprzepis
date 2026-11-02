import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { dbWritesAllowed, PRODUCTION_SUPABASE_HOST } from '../../e2e/db-writes'

// #375 (audit A8): local dev and the e2e suite share the production database, so a
// test that adds a recipe must not run unless it is explicitly pointed elsewhere.

const ROOT = new URL('../../', import.meta.url)
const E2E_DIR = fileURLToPath(new URL('e2e/', ROOT))
const OTHER_PROJECT = 'https://test-project-ref.supabase.co'

describe('dbWritesAllowed', () => {
  it('refuses when writes were not asked for', () => {
    expect(dbWritesAllowed({ NEXT_PUBLIC_SUPABASE_URL: OTHER_PROJECT })).toBe(false)
    expect(dbWritesAllowed({ E2E_DB_WRITES: 'true', NEXT_PUBLIC_SUPABASE_URL: OTHER_PROJECT })).toBe(false)
  })

  it('refuses the production project even when writes were asked for', () => {
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_HOST}` })).toBe(false)
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_HOST.toUpperCase()}/` })).toBe(false)
  })

  it('refuses an unknown target, since local dev defaults to production', () => {
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1' })).toBe(false)
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: ' ' })).toBe(false)
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: 'not a url' })).toBe(false)
  })

  it('allows a non-production project when writes were asked for', () => {
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: OTHER_PROJECT })).toBe(true)
    expect(dbWritesAllowed({ E2E_DB_WRITES: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' })).toBe(true)
  })
})

describe('e2e suite and the production database', () => {
  it('knows the production host that wrangler.jsonc deploys with', () => {
    const wrangler = readFileSync(new URL('wrangler.jsonc', ROOT), 'utf8')
    const url = wrangler.match(/"NEXT_PUBLIC_SUPABASE_URL"\s*:\s*"([^"]+)"/)?.[1]
    expect(url).toBeDefined()
    expect(new URL(url!).hostname).toBe(PRODUCTION_SUPABASE_HOST)
  })

  it('guards every spec that submits a recipe URL', () => {
    const specs = readdirSync(E2E_DIR).filter((name) => name.endsWith('.spec.ts'))
    const submitting = specs.filter((name) =>
      /getByLabel\(\s*['"]URL przepisu['"]\s*\)\s*\.fill\(\s*['"]https?:/.test(readFileSync(E2E_DIR + name, 'utf8')),
    )
    expect(submitting).toContain('add-recipe.spec.ts')
    for (const name of submitting) {
      expect(readFileSync(E2E_DIR + name, 'utf8'), `${name} submits a recipe URL without the dbWritesAllowed guard`).toMatch(
        /test\.skip\(\s*!dbWritesAllowed\(/,
      )
    }
  })
})
