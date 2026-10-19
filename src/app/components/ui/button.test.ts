import { describe, it, expect } from 'vitest'
import { buttonClasses } from './button'

describe('buttonClasses', () => {
  it('drops the global link underline, so a <Link> styled as a button reads as one', () => {
    for (const variant of ['primary', 'outline', 'danger', 'facebook'] as const) {
      expect(buttonClasses(variant)).toContain('no-underline!')
    }
  })
})
