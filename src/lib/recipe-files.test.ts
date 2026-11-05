import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { exportRecipeFiles } from '../../scripts/export-recipe-files.mjs'

const PAGE = '<html><body>sernik</body></html>'

describe('scripts/recipe-files.json', () => {
  it('lists each recipe once, as a slug that is safe in a file name', () => {
    const slugs: string[] = JSON.parse(readFileSync('scripts/recipe-files.json', 'utf8'))
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/)
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
    expect(await exportRecipeFiles(['sernik'], async () => ({ status: 200, html: PAGE }), root)).toEqual(['sernik'])
    expect(readFileSync(join(root, 'public/przepis/sernik.html'), 'utf8')).toBe(PAGE)
  })

  it('leaves on the Worker a missing recipe, a redirect, a cut-off page and a failed request', async () => {
    const root = project()
    const pages: Record<string, { status: number; html: string }> = {
      brak: { status: 404, html: PAGE },
      scalony: { status: 308, html: '' },
      uciety: { status: 200, html: '<html><body>' },
      sernik: { status: 200, html: PAGE },
    }
    const fetchPage = async (slug: string) => {
      if (slug === 'blad') throw new Error('refused')
      return pages[slug]
    }
    expect(await exportRecipeFiles(['brak', 'scalony', 'uciety', 'blad', 'sernik'], fetchPage, root)).toEqual(['sernik'])
    expect(readdirSync(join(root, 'public/przepis'))).toEqual(['sernik.html'])
  })

  it('removes the files of an earlier build', async () => {
    const root = project()
    mkdirSync(join(root, 'public/przepis'), { recursive: true })
    writeFileSync(join(root, 'public/przepis/stary.html'), 'stary')
    expect(await exportRecipeFiles([], async () => null, root)).toEqual([])
    expect(existsSync(join(root, 'public/przepis'))).toBe(false)
  })
})
