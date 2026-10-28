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

  it('is the compact framed action card, like "Udostępnij przepis"', () => {
    const html = render()
    expect(html).toContain('border-2')
    expect(html).toContain('rounded-xl')
    expect(html).toContain('min-h-[64px]')
  })
})
