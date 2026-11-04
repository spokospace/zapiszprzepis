import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// #701: the /lab/ recipe route only tests anything while no per-request input reaches it.
// A source-level guard, because one stray cookies() call silently makes Next render the
// route on every visit again and the experiment would measure nothing.
const root = join(__dirname)
// Comments explain what the files avoid, so only code is checked.
const code = (path: string) =>
  readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const sources = {
  page: code(join(root, 'przepis', '[slug]', 'page.tsx')),
  layout: code(join(root, 'layout.tsx')),
}

describe('/lab recipe experiment (#701)', () => {
  for (const [name, source] of Object.entries(sources)) {
    it(`${name} reads no per-request input`, () => {
      expect(source).not.toMatch(/next\/headers/)
      expect(source).not.toMatch(/supabase\/server/)
      expect(source).not.toMatch(/AppShell/)
      // getSiteUrl() falls back to headers() when NEXT_PUBLIC_SITE_URL is unset.
      expect(source).not.toMatch(/site-url/)
      expect(source).not.toMatch(/searchParams/)
    })
  }

  it('is revalidated on a timer, off by default, and kept out of indexes', () => {
    expect(sources.page).toMatch(/export const revalidate = 3600/)
    expect(sources.page).toMatch(/getPublicRecipeLongLived/)
    expect(sources.page).toMatch(/process\.env\.RECIPE_LAB !== '1'\) notFound\(\)/)
    expect(sources.page).toMatch(/index: false/)
  })
})
