import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ListeningScreen } from './listening-screen'

function render(heard: string) {
  return renderToStaticMarkup(createElement(ListeningScreen, { heard, onStop: () => {} }))
}

describe('ListeningScreen „Słucham…” (E01-S27)', () => {
  it('is a full-screen dialog with a 120 px action circle that pulses only without reduced motion', () => {
    const html = render('')
    expect(html).toMatch(/^<div role="dialog" aria-modal="true" aria-labelledby="listening-title" class="fixed inset-0/)
    expect(html).toContain('h-[120px] w-[120px]')
    expect(html).toContain('bg-action')
    expect(html).toContain('motion-safe:animate-pulse')
    expect(html).toContain('<h2 id="listening-title" class="text-[28px] font-bold text-ink">Słucham…</h2>')
  })

  it('shows the words heard so far at 24 px in a polite live region', () => {
    const html = render('zupa z dyni')
    expect(html).toMatch(/<p role="status" aria-live="polite" class="[^"]*text-\[24px\][^"]*">zupa z dyni<\/p>/)
  })

  it('offers „Przestań słuchać i pisz” as a 56 px button', () => {
    const button = render('').match(/<button[^>]*>.*?<\/button>/)?.[0] ?? ''
    expect(button).toContain('min-h-14')
    expect(button).toMatch(/<\/svg>Przestań słuchać i pisz<\/button>$/)
  })
})
