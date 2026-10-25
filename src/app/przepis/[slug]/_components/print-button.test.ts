import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PrintButton } from './print-button'

function render(props: Parameters<typeof PrintButton>[0] = {}) {
  return renderToStaticMarkup(createElement(PrintButton, props))
}

describe('PrintButton (A9 "Drukuj")', () => {
  it('is a plain button labelled "Drukuj" with an icon', () => {
    const html = render()
    expect(html).toMatch(/^<button type="button"/)
    expect(html).toContain('Drukuj')
    // The printer glyph is decorative; the label names the control.
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('<svg')
  })

  it('defaults to the outlined secondary-button look, like "Udostępnij"', () => {
    const html = render()
    expect(html).toContain('border-2')
    expect(html).toContain('rounded-pill')
    expect(html).toContain('min-h-[48px]')
  })

  it('takes a className override so it can match the share button in the row', () => {
    expect(render({ className: 'custom-print-class' })).toContain('class="custom-print-class"')
  })
})
