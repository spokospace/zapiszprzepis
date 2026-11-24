import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearDataCache,
  clearSitemap,
  exportHomePage,
  exportRecipeFiles,
  exportSearchPage,
  exportShortfall,
  exportSitemap,
  sitemapRecipeCount,
  sitemapShortfall,
  versionToSave,
  warsawDay,
} from '../../scripts/export-recipe-files.mjs'

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

describe('exportSitemap', () => {
  const root = () => {
    const dir = mkdtempSync(join(tmpdir(), 'sitemap-file-'))
    mkdirSync(join(dir, 'public'))
    return dir
  }
  const loc = (path: string) => `<url><loc>https://zapiszprzepis.pl${path}</loc><lastmod>2026-11-09T10:00:00.000Z</lastmod></url>`
  const xml = (...paths: string[]) => `<?xml version="1.0" encoding="UTF-8"?><urlset>${paths.map(loc).join('')}</urlset>`

  it('saves the sitemap as the route wrote it and counts its recipes', async () => {
    const dir = root()
    const sitemap = xml('/', '/przepisy/zupy', '/przepis/sernik', '/przepis/piernik', '/u/ania')
    expect(await exportSitemap(async () => ({ status: 200, html: sitemap }), dir)).toBe(2)
    expect(readFileSync(join(dir, 'public/sitemap.xml'), 'utf8')).toBe(sitemap)
    rmSync(dir, { recursive: true })
  })

  it.each([
    // What the route answers when the database read fails: the pages it knows without it.
    ['a sitemap without recipes', async () => ({ status: 200, html: xml('/', '/przepisy/zupy', '/regulamin') })],
    ['an error', async () => ({ status: 500, html: xml('/przepis/sernik') })],
    ['a cut-off sitemap', async () => ({ status: 200, html: '<urlset><url><loc>https://zapiszprzepis.pl/przepis/sernik</loc>' })],
    ['no answer', async () => Promise.reject(new Error('down'))],
  ])('saves no file after %s', async (_name, fetchPage) => {
    const dir = root()
    expect(await exportSitemap(fetchPage, dir)).toBe(0)
    expect(existsSync(join(dir, 'public/sitemap.xml'))).toBe(false)
    rmSync(dir, { recursive: true })
  })

  it('counts a recipe listed twice once', () => {
    expect(sitemapRecipeCount(xml('/przepis/sernik', '/przepis/sernik', '/przepisy/ciasta'))).toBe(1)
  })

  it('clearSitemap removes the file an earlier build left, and is quiet without one', () => {
    const dir = root()
    writeFileSync(join(dir, 'public/sitemap.xml'), 'old')
    clearSitemap(dir)
    clearSitemap(dir)
    expect(existsSync(join(dir, 'public/sitemap.xml'))).toBe(false)
    rmSync(dir, { recursive: true })
  })
})

describe('sitemapShortfall', () => {
  it('fails the build when the sitemap lists no recipes (from 2026-11-11 production listed 17 URLs, none a recipe)', () => {
    expect(sitemapShortfall('all', 0, 932)).toMatch(/only 0 of 932/)
  })

  it('fails the build when the sitemap lists under nine recipes in ten', () => {
    expect(sitemapShortfall('all', 89, 100)).toMatch(/89 of 100/)
  })

  it('ships a sitemap that lists nine in ten or more', () => {
    expect(sitemapShortfall('all', 90, 100)).toBeNull()
    expect(sitemapShortfall('all', 932, 932)).toBeNull()
  })

  it('never fails a build that lists slugs itself, [] included', () => {
    expect(sitemapShortfall([], 0, 0)).toBeNull()
    expect(sitemapShortfall(['a', 'b'], 0, 2)).toBeNull()
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

describe('exportShortfall', () => {
  it('fails the build when the database lists no recipes (2026-11-11: a Supabase outage shipped none)', () => {
    expect(exportShortfall('all', 0, 0)).toMatch(/no public recipes/)
  })

  it('fails the build when most recipes did not export', () => {
    expect(exportShortfall('all', 89, 100)).toMatch(/89 of 100/)
  })

  it('ships when nine in ten or more exported', () => {
    expect(exportShortfall('all', 90, 100)).toBeNull()
    expect(exportShortfall('all', 932, 932)).toBeNull()
  })

  it('never fails a build that lists slugs itself, [] included', () => {
    expect(exportShortfall([], 0, 0)).toBeNull()
    expect(exportShortfall(['a', 'b'], 0, 2)).toBeNull()
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
