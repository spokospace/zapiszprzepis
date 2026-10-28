import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PrintButton } from './print-button'

function render() {
  return renderToStaticMarkup(createElement(PrintButton))
}

describe('PrintButton (A9 "Wydrukuj przepis")', () => {
  it('is a plain button labelled "Wydrukuj przepis" with an icon', () => {
    const html = render()
    expect(html).toMatch(/^<button type="button"/)
    expect(html).toContain('Wydrukuj przepis')
    // The printer glyph is decorative; the label names the control.
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('<svg')
  })

  it('is a quiet text button, 48 px high, with no frame (handoff 2026-10-28)', () => {
    const html = render()
    expect(html).toContain('min-h-[48px]')
    expect(html).toContain('text-action-text')
    expect(html).not.toContain('border-2')
  })
})
