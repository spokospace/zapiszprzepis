import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecipeListBar } from './recipe-list-bar'
import { RecipeBreadcrumbs } from './recipe-header'
import type { ListPosition } from '@/lib/recipe-list-context'

const POSITION: ListPosition = {
  label: 'Zupy',
  href: '/przepisy/zupy',
  index: 3,
  total: 18,
  prev: { slug: 'barszcz', title: 'Barszcz czerwony' },
  next: { slug: 'krem', title: 'Krem z pieczonej papryki' },
}

function bar(fallback: ListPosition | null = POSITION) {
  return renderToStaticMarkup(createElement(RecipeListBar, { slug: 'zupa', from: null, fallback }))
}

describe('RecipeListBar (A4 phones, A9 desktop)', () => {
  it('is a flat row over a rule, not a boxed card', () => {
    const nav = bar().match(/<nav[^>]*>/)?.[0] ?? ''
    expect(nav).toContain('border-b border-border-card')
    expect(nav).not.toContain('rounded-card')
  })

  it('leads with an arrow icon and the 18 px list name', () => {
    const link = bar().match(/<a[^>]*href="\/przepisy\/zupy"[^>]*>.*?<\/a>/)?.[0] ?? ''
    expect(link).toContain('text-[18px] font-bold')
    expect(link).toMatch(/<svg[^>]*aria-hidden="true"[^>]*>.*<\/svg>Zupy<\/a>$/)
    expect(link).not.toContain('←')
  })

  it('shows "N z M" as 16 px secondary text, joined with "·" from lg', () => {
    const html = bar()
    expect(html).toContain('<span class="shrink-0 text-[16px] text-ink-soft lg:text-[18px] lg:font-bold lg:text-ink">')
    expect(html).toContain('<span aria-hidden="true"><span class="hidden lg:inline">· </span>3 z 18</span>')
    expect(html).toContain('<span class="sr-only">Przepis 3 z 18 na liście Zupy</span>')
  })

  it('renders nothing for a list of one', () => {
    expect(bar({ ...POSITION, index: 1, total: 1, prev: null, next: null })).toBe('')
  })
})

describe('RecipeBreadcrumbs', () => {
  it('links "Przepisy" to search and the category in the accent colour (A4/A9)', () => {
    const html = renderToStaticMarkup(createElement(RecipeBreadcrumbs, { category: 'zupy', className: 'hidden lg:block' }))
    expect(html).toMatch(/^<nav aria-label="Okruszki" class="text-\[16px\] text-ink-soft hidden lg:block">/)
    expect(html).toMatch(/<a[^>]*href="\/szukaj"[^>]*>Przepisy<\/a>/)
    expect(html).toMatch(/<a[^>]*class="font-bold text-action-text underline[^"]*"[^>]*>Zupy<\/a>/)
  })
})
