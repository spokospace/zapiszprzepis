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
    expect(html.match(/<li><a /g)).toHaveLength(VISIBLE_CHIPS)
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
