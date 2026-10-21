import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The chips navigate through the router inside the list's transition; a static render needs a stub.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { TagFilter, toggleTag, VISIBLE_CHIPS, type TagChip } from './tag-filter'

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

  it("clips the chips' sr-only text inside the row, so it never widens the page (#448)", () => {
    // sr-only is position: absolute; the row must be its containing block.
    const ul = html.match(/<ul id="[^"]+" class="([^"]+)"/)?.[1] ?? ''
    expect(ul).toMatch(/(^| )relative( |$)/)
    expect(html).toContain('class="sr-only"')
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

describe('TagFilter instant feedback (#435)', () => {
  it('toggles a tag in the optimistic selection without touching the original', () => {
    const before = new Set(['kruche'])
    expect([...toggleTag(before, 'czekoladowe')].sort()).toEqual(['czekoladowe', 'kruche'])
    expect([...toggleTag(before, 'kruche')]).toEqual([])
    expect([...before]).toEqual(['kruche'])
  })

  it('renders a selected chip as selected (✓, "wybrany") and keeps every chip a real link', () => {
    const chips = [{ ...chip(1), selected: true }, chip(2)]
    const html = renderToStaticMarkup(createElement(TagFilter, { chips, question: 'Jakie ciasta?' }))
    expect(html).toContain('✓ ')
    expect(html).toContain(', wybrany')
    expect(html.match(/<a [^>]*href="\/przepisy\/ciasta\?tag=tag-\d"/g)).toHaveLength(2)
  })
})

describe('TagFilter scroll buttons (phone)', () => {
  // The buttons only render once the row can scroll (client state), so their classes are checked in the source.
  const source = readFileSync(join(process.cwd(), 'src/app/przepisy/[kategoria]/_components/tag-filter.tsx'), 'utf8')

  it('reach the screen edges like the row, so no chip peeks out beside them', () => {
    expect(source).toContain('-left-4')
    expect(source).toContain('sm:-left-6')
    expect(source).toContain('-right-4')
    expect(source).toContain('sm:-right-6')
  })

  it('are phone-only', () => {
    expect(source.match(/text-ink[^"]*md:hidden/g)).toHaveLength(2)
  })
})
