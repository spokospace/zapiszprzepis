import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// next/link consumes `prefetch` as its own prop and never renders it to the DOM, so
// the real component cannot prove the neighbour links ask for a full prefetch. A
// passthrough mock surfaces it as data-prefetch. Isolated in its own file: vitest
// scopes vi.mock per module, so the sibling recipe-list-bar.test.ts keeps the real Link.
vi.mock('next/link', async () => {
  const react = await import('react')
  return {
    default: ({ href, prefetch, children }: { href: string; prefetch?: boolean; children?: ReactNode }) =>
      react.createElement('a', { href, 'data-prefetch': prefetch === true ? 'full' : 'default' }, children),
  }
})

import { RecipeListNav } from './recipe-list-bar'
import { recipePath } from '@/lib/routes'
import type { ListPosition } from '@/lib/recipe-list-context'

const POSITION: ListPosition = {
  label: 'Zupy',
  href: '/przepisy/zupy',
  index: 3,
  total: 18,
  prev: { slug: 'barszcz', title: 'Barszcz czerwony' },
  next: { slug: 'krem', title: 'Krem z pieczonej papryki' },
}

describe('RecipeListNav prefetch (#464 item 3)', () => {
  // A recipe not opened from a list shows only „Następny”; that one link must still
  // fully prefetch so the click lands on the recipe, not the loading skeleton.
  const html = renderToStaticMarkup(createElement(RecipeListNav, { slug: 'zupa', from: null, fallback: POSITION }))

  it('requests a full prefetch of the next recipe, not just the loading skeleton', () => {
    const link = html.match(new RegExp(`<a [^>]*href="${recipePath('krem')}"[^>]*>`))?.[0] ?? ''
    expect(link).toContain('data-prefetch="full"')
  })
})
