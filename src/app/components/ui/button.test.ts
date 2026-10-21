import { describe, it, expect } from 'vitest'
import { buttonClasses } from './button'

describe('buttonClasses', () => {
  it('drops the global link underline, so a <Link> styled as a button reads as one', () => {
    for (const variant of ['primary', 'dark', 'outline', 'danger', 'facebook'] as const) {
      expect(buttonClasses(variant)).toContain('no-underline!')
    }
  })
})

describe('buttonClasses shape (style 1b)', () => {
  it('renders every variant as a pill, never the legacy rounded-field', () => {
    for (const variant of ['primary', 'dark', 'outline', 'danger', 'facebook'] as const) {
      const classes = buttonClasses(variant)
      expect(classes).toContain('rounded-pill')
      expect(classes).not.toContain('rounded-field')
    }
  })

  it('frames the secondary (outline) button with the 2 px ink border', () => {
    expect(buttonClasses('outline')).toContain('border-2 border-ink')
  })
})
