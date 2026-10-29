import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/app/(authenticated)/recipes/search-via-exa-action', () => ({ searchViaExa: vi.fn() }))
vi.mock('@/app/(authenticated)/recipes/add-recipe-action', () => ({ addRecipeFromUrl: vi.fn() }))

import type { ExaResult } from '@/app/(authenticated)/recipes/search-via-exa-action'
import { BlogPanel, SearchTabs, blogTabCaption, shouldSearchBlogs, type BlogState } from './search-tabs'

function tabs(isAuthenticated: boolean) {
  return renderToStaticMarkup(
    createElement(
      SearchTabs,
      { q: 'dynia', localCount: '12 przepisów', hasLocalResults: true, isAuthenticated, hasFullAccess: false },
      createElement('p', null, 'LOCAL-RESULTS'),
    ),
  )
}

function panel(state: BlogState, { isAuthenticated = true, hasFullAccess = false } = {}) {
  return renderToStaticMarkup(createElement(BlogPanel, { q: 'dynia', state, isAuthenticated, hasFullAccess, onRetry: () => {} }))
}

const result = (existing: ExaResult['existing'] = null): ExaResult => ({
  url: 'https://www.kwestiasmaku.com/dynia',
  title: 'Zupa z dyni',
  highlights: ['Dynię kroimy w kostkę.'],
  existing,
})

describe('SearchTabs', () => {
  it('opens on „W serwisie” with its count and results; „Na blogach” waits for a click', () => {
    const html = tabs(true)
    expect(html).toMatch(/<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*>.*W serwisie.*12 przepisów/)
    expect(html).toMatch(/aria-selected="false"[^>]*>.*Na blogach.*kliknij, aby szukać/)
    expect(html).toContain('LOCAL-RESULTS')
    expect(html).toContain('Szukaj „dynia” na blogach')
    // The blog panel exists for aria-controls but is hidden and empty: nothing searched yet.
    expect(html).toMatch(/<div role="tabpanel" id="search-panel-web"[^>]*hidden=""[^>]*><\/div>/)
    expect(html).not.toContain('Szukamy na blogach')
  })

  it('shows a guest the blog tab with a lock and „po zalogowaniu”', () => {
    const html = tabs(false)
    expect(html).toContain('Na blogach')
    expect(html).toContain('(wymaga logowania)')
    expect(html).toContain('po zalogowaniu')
  })
})

describe('shouldSearchBlogs', () => {
  it('never searches for a guest (Exa is paid)', () => {
    expect(shouldSearchBlogs(false, { kind: 'idle' })).toBe(false)
  })

  it('searches once per query: not again while searching or once results are in', () => {
    expect(shouldSearchBlogs(true, { kind: 'idle' })).toBe(true)
    expect(shouldSearchBlogs(true, { kind: 'searching' })).toBe(false)
    expect(shouldSearchBlogs(true, { kind: 'results', results: [] })).toBe(false)
  })
})

describe('blogTabCaption', () => {
  it('names the blog count once the search ran', () => {
    expect(blogTabCaption(true, { kind: 'results', results: [result(), result()] })).toBe('2 przepisy')
    expect(blogTabCaption(true, { kind: 'idle' })).toBe('kliknij, aby szukać')
    expect(blogTabCaption(false, { kind: 'idle' })).toBe('po zalogowaniu')
  })
})

describe('BlogPanel', () => {
  it('leads a guest to login and back to this search — no blog request, no blog link', () => {
    const html = panel({ kind: 'idle' }, { isAuthenticated: false })
    expect(html).toContain('href="/login?next=%2Fszukaj%3Fq%3Ddynia"')
    expect(html).toContain('Szukanie na blogach po zalogowaniu')
    expect(html).not.toContain('target="_blank"')
  })

  it('lists blog results with domain, title, snippet, count and „Otwórz stronę bloga”', () => {
    const html = panel({ kind: 'results', results: [result(), { ...result(), url: 'https://b.pl/x' }] })
    expect(html).toMatch(/<strong>2 przepisy<\/strong> z blogów dla „dynia”/)
    expect(html).toContain('kwestiasmaku.com')
    expect(html).toContain('Zupa z dyni')
    expect(html).toContain('Dynię kroimy w kostkę.')
    expect(html).toContain('Otwórz stronę bloga')
    expect(html).toContain('(w nowej karcie)')
  })

  it('without full access offers „Odblokuj zapisywanie” (code gate), never a save form', () => {
    const html = panel({ kind: 'results', results: [result()] })
    expect(html).toMatch(/href="\/dodaj"[^>]*>.*Odblokuj zapisywanie/)
    expect(html).not.toContain('<form')
    expect(html).not.toContain('Zapisz do moich przepisów')
  })

  it('with full access saves a new blog result', () => {
    const html = panel({ kind: 'results', results: [result()] }, { hasFullAccess: true })
    expect(html).toContain('<form')
    expect(html).toContain('name="url" value="https://www.kwestiasmaku.com/dynia"')
    expect(html).toContain('Zapisz do moich przepisów')
    expect(html).not.toContain('Odblokuj zapisywanie')
  })

  it('points a link someone already added to that recipe instead of saving it again', () => {
    const html = panel({ kind: 'results', results: [result({ owner: 'other', slug: 'zupa-z-dyni' })] }, { hasFullAccess: true })
    expect(html).toContain('Ten przepis jest już w aplikacji Zapisz Przepis')
    expect(html).toMatch(/href="\/przepis\/zupa-z-dyni"[^>]*>.*Otwórz w aplikacji Zapisz Przepis/)
    expect(html).not.toContain('<form')
  })

  it('tells the user a link is already in their own recipes', () => {
    const html = panel({ kind: 'results', results: [result({ owner: 'own', slug: 'moja-zupa' })] })
    expect(html).toContain('Masz go w Moich przepisach')
    expect(html).toContain('href="/przepis/moja-zupa"')
    expect(html).not.toContain('Odblokuj zapisywanie')
  })

  it('says when no blog matched, and offers a retry after an error', () => {
    expect(panel({ kind: 'results', results: [] })).toContain('Nic nie znaleźliśmy na blogach dla „dynia”')
    const err = panel({ kind: 'error', rateLimited: false })
    expect(err).toContain('role="alert"')
    expect(err).toContain('Spróbuj ponownie')
  })
})
