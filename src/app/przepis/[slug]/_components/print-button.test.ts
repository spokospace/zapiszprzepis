import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PrintButton } from './print-button'

function render() {
  return renderToStaticMarkup(createElement(PrintButton))
}

describe('PrintButton (A9; handoff 2026-10-28 "Drukuj")', () => {
  it('is a plain button labelled "Drukuj" with an icon', () => {
    const html = render()
    expect(html).toMatch(/^<button type="button"/)
    expect(html).toContain('Drukuj')
    // The printer glyph is decorative; the label names the control.
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('<svg')
  })

  it('is a quiet ink text button, 48 px high, with no frame and no underline', () => {
    const html = render()
    expect(html).toContain('min-h-[48px]')
    expect(html).toContain('text-ink')
    expect(html).not.toContain('border-2')
    expect(html).not.toContain('underline')
  })
})
