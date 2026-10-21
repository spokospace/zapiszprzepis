import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TagFilter, VISIBLE_CHIPS, type TagChip } from './tag-filter'

const chip = (i: number): TagChip => ({
  value: `tag-${i}`,
  label: `tag ${i}`,
  count: i,
  selected: false,
  href: `/przepisy/ciasta?tag=tag-${i}`,
})

function render(count: number) {
  const chips = Array.from({ length: count }, (_, i) => chip(i + 1))
  return renderToStaticMarkup(createElement(TagFilter, { chips, question: 'Jakie ciasta?' }))
}

describe('TagFilter "Pokaż wszystkie (N)" (screen 6)', () => {
  it('shows the toggle past the first chips, with the full count', () => {
    const html = render(VISIBLE_CHIPS + 3)
    expect(html).toContain(`Pokaż wszystkie (${VISIBLE_CHIPS + 3})`)
    // From md only the first chips show; the rest are in the DOM for the phone row.
    expect(html.match(/<li class="shrink-0 md:shrink"><a /g)).toHaveLength(VISIBLE_CHIPS)
    expect(html.match(/<li class="shrink-0 md:shrink hidden max-md:block"><a /g)).toHaveLength(3)
  })

  it('lets its label break a long word instead of widening the page at 320 px / A++ (WCAG 1.4.10)', () => {
    const toggle = render(VISIBLE_CHIPS + 1).match(/<button[^>]*aria-expanded="false"[^>]*>/)?.[0] ?? ''
    expect(toggle).toContain('wrap-anywhere')
    // Still a 48 px, underlined text action.
    expect(toggle).toContain('min-h-[48px]')
    expect(toggle).toContain('underline')
  })

  it('has no toggle when every chip fits', () => {
    expect(render(VISIBLE_CHIPS)).not.toContain('Pokaż wszystkie')
  })
})

describe('TagFilter on a phone (style 1b)', () => {
  const html = render(VISIBLE_CHIPS + 3)

  it('is one row that scrolls sideways inside itself, to the screen edges', () => {
    const ul = html.match(/<ul id="[^"]+" class="([^"]+)"/)?.[1] ?? ''
    expect(ul).toContain('overflow-x-auto')
    expect(ul).not.toMatch(/(^| )flex-wrap/)
    expect(ul).toContain('md:flex-wrap')
    expect(ul).toContain('md:overflow-visible')
    expect(ul).toContain('-mx-4')
  })

  it('keeps a chip on one line so the row can scroll', () => {
    expect(html).toContain('max-md:whitespace-nowrap')
  })

  it('hides "Pokaż wszystkie" on a phone, where every chip is already in the row', () => {
    expect(html).toMatch(/<li class="max-md:hidden"><button[^>]*aria-expanded/)
  })

  it('shows no scroll buttons before hydration (they appear only when there is more to scroll)', () => {
    expect(html).not.toContain('Przewiń filtry')
  })
})
