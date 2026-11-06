import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { PRODUCTION_SUPABASE_URL } from './image-remote-patterns'
import { securityHeaders } from './security-headers'

describe('public/_headers', () => {
  const rules = readFileSync('public/_headers', 'utf8')

  it('caches hashed build output for a year', () => {
    expect(rules).toMatch(/^\/_next\/static\/\*\r?\n\s+Cache-Control: public, max-age=31536000, immutable/m)
  })

  it('leaves everything else, such as sw.js, on the revalidating default', () => {
    expect(rules.match(/^\//gm)).toHaveLength(4)
    expect(rules).not.toMatch(/^\/przepis\/\*(?:\r?\n\s+.*)*Cache-Control/m)
  })

  it('gives recipe files the headers the middleware gives a rendered page', () => {
    for (const path of ['/przepis/*', '/szukaj', '/']) {
      const block = rules.split(/\r?\n\r?\n/).find((b) => b.split(/\r?\n/).find((line) => line.startsWith('/')) === path) ?? ''
      for (const [name, value] of securityHeaders({ supabaseUrl: PRODUCTION_SUPABASE_URL })) {
        expect(block, path).toContain(`  ${name}: ${value}`)
      }
    }
  })
})
