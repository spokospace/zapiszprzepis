import { describe, it, expect } from 'vitest'
import { TRUSTED_RECIPE_DOMAINS } from '@/lib/recipe-source-domains'

// The list goes to Exa as includeDomains: Exa refuses more than 1200 entries,
// and an empty list would mean no filter at all, i.e. gov.pl and fitness
// portals back in the results.
describe('TRUSTED_RECIPE_DOMAINS', () => {
  it('fits within the Exa includeDomains limit and is not empty', () => {
    expect(TRUSTED_RECIPE_DOMAINS.length).toBeGreaterThan(100)
    expect(TRUSTED_RECIPE_DOMAINS.length).toBeLessThanOrEqual(1200)
  })

  it('has no duplicates', () => {
    expect(new Set(TRUSTED_RECIPE_DOMAINS).size).toBe(TRUSTED_RECIPE_DOMAINS.length)
  })

  // Only Facebook profiles may carry a path: a path on a blog would hide its
  // posts from Exa, while on facebook.com it is what scopes it to one author.
  it('holds bare lowercase hostnames, or a facebook.com profile id path', () => {
    for (const domain of TRUSTED_RECIPE_DOMAINS) {
      expect(domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$|^facebook\.com\/\d+$/)
      expect(domain).not.toMatch(/^www\./)
    }
  })

  it('never lets the whole of facebook.com in', () => {
    expect(TRUSTED_RECIPE_DOMAINS).not.toContain('facebook.com')
    expect(TRUSTED_RECIPE_DOMAINS).toContain('facebook.com/100069645633702')
  })

  it('includes both the hand-picked portals and the aggregated blogs', () => {
    expect(TRUSTED_RECIPE_DOMAINS).toContain('kwestiasmaku.com')
    expect(TRUSTED_RECIPE_DOMAINS.some((d) => d.endsWith('.blogspot.com'))).toBe(true)
  })
})
