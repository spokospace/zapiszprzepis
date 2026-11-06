import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { clearDataCache, exportHomePage, exportRecipeFiles, exportSearchPage, versionToSave, warsawDay } from '../../scripts/export-recipe-files.mjs'

const PAGE = '<html><script type="application/ld+json">{"@type":"Recipe"}</script></html>'

describe('exportSearchPage', () => {
  const root = () => {
    const dir = mkdtempSync(join(tmpdir(), 'search-file-'))
    mkdirSync(join(dir, 'public'))
    return dir
  }

  it('saves a finished page', async () => {
    const dir = root()
    const html = '<html><h1>Szukaj przepisu</h1></html>'
    expect(await exportSearchPage(async () => ({ status: 200, html }), dir)).toBe(true)
    expect(readFileSync(join(dir, 'public/szukaj.html'), 'utf8')).toBe(html)
    rmSync(dir, { recursive: true })
  })

  it.each([
    ['an error page', async () => ({ status: 500, html: '<html>Szukaj przepisu</html>' })],
    ['a page without the search', async () => ({ status: 200, html: '<html>inna</html>' })],
    ['no answer', async () => Promise.reject(new Error('down'))],
  ])('leaves no file after %s, so the Worker answers', async (_name, fetchPage) => {
    const dir = root()
    writeFileSync(join(dir, 'public/szukaj.html'), 'old')
    expect(await exportSearchPage(fetchPage, dir)).toBe(false)
    expect(existsSync(join(dir, 'public/szukaj.html'))).toBe(false)
    rmSync(dir, { recursive: true })
  })
})

describe('exportHomePage', () => {
  const root = () => {
    const dir = mkdtempSync(join(tmpdir(), 'home-file-'))
    mkdirSync(join(dir, 'public'))
    return dir
  }

  it('saves a finished page', async () => {
    const dir = root()
    const html = '<html><script type="application/ld+json">{"@type":"WebSite"}</script></html>'
    expect(await exportHomePage(async () => ({ status: 200, html }), dir)).toBe(true)
    expect(readFileSync(join(dir, 'public/index.html'), 'utf8')).toBe(html)
    rmSync(dir, { recursive: true })
  })

  it.each([
    ['an error page', async () => ({ status: 500, html: '<html>"@type":"WebSite"</html>' })],
    ['a page without the site data', async () => ({ status: 200, html: '<html>inna</html>' })],
    ['no answer', async () => Promise.reject(new Error('down'))],
  ])('leaves no file after %s, so the Worker answers', async (_name, fetchPage) => {
    const dir = root()
    writeFileSync(join(dir, 'public/index.html'), 'old')
    expect(await exportHomePage(fetchPage, dir)).toBe(false)
    expect(existsSync(join(dir, 'public/index.html'))).toBe(false)
    rmSync(dir, { recursive: true })
  })
})

describe('warsawDay', () => {
  it('rolls over at Polish midnight, not UTC', () => {
    expect(warsawDay(new Date('2026-11-06T22:59:00Z'))).toBe('2026-11-06')
    expect(warsawDay(new Date('2026-11-06T23:00:00Z'))).toBe('2026-11-07')
  })
})

describe('scripts/recipe-files.json', () => {
  it('lists each recipe once, as a slug that is safe in a file name', () => {
    const listed: string[] | 'all' = JSON.parse(readFileSync('scripts/recipe-files.json', 'utf8'))
    const slugs = listed === 'all' ? [] : listed
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/)
  })
})

describe('versionToSave', () => {
  it('keeps the version when one recipe in a hundred is missing, or none are', () => {
    expect(versionToSave(7, 99, 100)).toBe(7)
    expect(versionToSave(7, 0, 0)).toBe(7)
  })

  it('saves no version after a short export, so the cron asks again', () => {
    expect(versionToSave(7, 98, 100)).toBeNull()
  })
})

describe('exportRecipeFiles', () => {
  const roots: string[] = []
  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })))

  function project() {
    const root = mkdtempSync(join(tmpdir(), 'recipe-files-'))
    roots.push(root)
    return root
  }

  it('saves a finished page under its slug', async () => {
    const root = project()
    expect(await exportRecipeFiles(['sernik'], async () => ({ status: 200, html: PAGE }), { root })).toEqual(['sernik'])
    expect(readFileSync(join(root, 'public/przepis/sernik.html'), 'utf8')).toBe(PAGE)
  })

  it('leaves on the Worker a missing recipe, a redirect, a cut-off page and a failed request', async () => {
    const root = project()
    const pages: Record<string, { status: number; html: string }> = {
      brak: { status: 404, html: PAGE },
      scalony: { status: 308, html: '' },
      uciety: { status: 200, html: PAGE.replace('</html>', '') },
      nieudany: { status: 200, html: '<html><body>Coś poszło nie tak</body></html>' },
      sernik: { status: 200, html: PAGE },
    }
    const fetchPage = async (slug: string) => {
      if (slug === 'blad') throw new Error('refused')
      return pages[slug]
    }
    expect(await exportRecipeFiles(['brak', 'scalony', 'uciety', 'nieudany', 'blad', 'sernik'], fetchPage, { root })).toEqual(['sernik'])
    expect(readdirSync(join(root, 'public/przepis'))).toEqual(['sernik.html'])
  })

  it('stops at the deadline and leaves the rest on the Worker', async () => {
    const root = project()
    const slugs = Array.from({ length: 50 }, (_, i) => `przepis-${i}`)
    expect(await exportRecipeFiles(slugs, async () => ({ status: 200, html: PAGE }), { root, deadline: Date.now() - 1 })).toEqual([])
  })

  it('saves every recipe when more arrive than run at once', async () => {
    const root = project()
    const slugs = Array.from({ length: 50 }, (_, i) => `przepis-${i}`)
    const exported = await exportRecipeFiles(slugs, async () => ({ status: 200, html: PAGE }), { root })
    expect(exported.sort()).toEqual([...slugs].sort())
  })

  it('leaves no data cache behind, or OpenNext would upload it to R2', () => {
    const root = project()
    mkdirSync(join(root, '.next/cache/fetch-cache'), { recursive: true })
    clearDataCache(root)
    expect(existsSync(join(root, '.next/cache/fetch-cache'))).toBe(false)
  })

  it('removes the files of an earlier build', async () => {
    const root = project()
    mkdirSync(join(root, 'public/przepis'), { recursive: true })
    writeFileSync(join(root, 'public/przepis/stary.html'), 'stary')
    expect(await exportRecipeFiles([], async () => null, { root })).toEqual([])
    expect(existsSync(join(root, 'public/przepis'))).toBe(false)
  })
})
