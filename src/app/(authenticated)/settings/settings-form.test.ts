import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./actions', () => ({ saveProfileSettings: vi.fn() }))
vi.mock('./resize-avatar', () => ({ resizeAvatar: vi.fn() }))

import { SettingsForm } from './settings-form'

function render(addedLine?: string | null) {
  return renderToStaticMarkup(
    createElement(SettingsForm, {
      initialDisplayName: 'Antonina K.',
      initialFirstName: 'Antonina',
      avatarSrc: null,
      colorIndex: 0,
      profileHref: null,
      addedLine,
    }),
  )
}

describe('SettingsForm preview (2a, E01-S23)', () => {
  it('shows the gendered "Dodałaś …" line from the server', () => {
    const html = render('Dodałaś 3 przepisy.')
    expect(html).toContain('Dodałaś 3 przepisy.')
    expect(html).not.toContain('Tak przywitamy Cię')
  })

  it.each([undefined, null])('falls back to the neutral sentence for %p', (line) => {
    const html = render(line)
    expect(html).toContain('Tak przywitamy Cię na stronie głównej.')
    expect(html).not.toMatch(/Dodałaś|Dodałeś/)
  })
})
