import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('public/_headers', () => {
  const rules = readFileSync('public/_headers', 'utf8')

  it('caches hashed build output for a year', () => {
    expect(rules).toMatch(/^\/_next\/static\/\*\r?\n\s+Cache-Control: public, max-age=31536000, immutable/m)
  })

  it('leaves everything else, such as sw.js, on the revalidating default', () => {
    expect(rules.match(/^\//gm)).toHaveLength(1)
  })
})
