import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// #701: on production about half of all Worker invocations were Next.js prefetches, mostly
// the always-visible header and category links. Their targets (/, /szukaj, /przepisy/*)
// have no loading.tsx, so a prefetch caches nothing useful and only spends CPU on the
// Free plan. next/link consumes `prefetch` as its own prop, so a render cannot show it;
// the source is the guard. Comments are stripped so only code counts.
const code = (file: string) =>
  readFileSync(join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const links = (source: string) => source.match(/<Link\b[^>]*>/g) ?? []

describe('always-visible links do not prefetch (#701)', () => {
  it('app-header: the logo and Szukaj links', () => {
    const tags = links(code('app-header.tsx'))
    for (const href of ['href="/"', 'href={SEARCH_PATH}']) {
      const tag = tags.find((t) => t.includes(href))
      expect(tag, href).toBeDefined()
      expect(tag).toContain('prefetch={false}')
    }
  })

  it('category-bar: every category link', () => {
    const tags = links(code('category-bar.tsx'))
    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) expect(tag).toContain('prefetch={false}')
  })

  it('home category grid: every category tile', () => {
    const tags = links(code(join('home', 'category-grid.tsx')))
    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) expect(tag).toContain('prefetch={false}')
  })
})
