import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/app/(authenticated)/recipes/add-recipe-action', () => ({ addRecipeFromUrl: vi.fn() }))

import { AddFromLinkFormView, readLinkFromClipboard } from './add-from-link-form'
import type { AddRecipeError } from '@/lib/routes'

function render(extra: { error?: AddRecipeError | null; canPaste?: boolean; pasteFailed?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(AddFromLinkFormView, {
      value: '',
      onValueChange: vi.fn(),
      error: extra.error ?? null,
      canPaste: extra.canPaste ?? false,
      pasteFailed: extra.pasteFailed ?? false,
      onPaste: vi.fn(),
    }),
  )
}

describe('AddFromLinkFormView — the /dodaj link form (E01-S10)', () => {
  it('labels the link field visibly and submits it as `url`', () => {
    const html = render()
    expect(html).toContain('<label for="recipe-link"')
    expect(html).toContain('Link do przepisu')
    expect(html).toContain('id="recipe-link"')
    expect(html).toContain('name="url"')
    expect(html).toContain('inputMode="url"')
    expect(html).toContain('border-field')
    expect(html).toContain('Dodaj przepis')
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('aria-invalid')
  })

  it('shows an error as role=alert tied to the field, with the danger border', () => {
    const html = render({ error: 'invalid_url' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('To nie wygląda jak prawidłowy URL.')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="recipe-link-error"')
    expect(html).toContain('id="recipe-link-error"')
    expect(html).toContain('border-danger')
  })

  it('asks for a link (not a name) when the field was empty', () => {
    expect(render({ error: 'empty' })).toContain('Wklej link do przepisu.')
  })

  it('renders „Wklej” only where the Clipboard API can read', () => {
    expect(render({ canPaste: false })).not.toContain('Wklej</button>')
    expect(render({ canPaste: true })).toMatch(/<button[^>]*type="button"[^>]*>.*Wklej<\/button>/)
  })

  it('explains the long-press fallback when pasting failed', () => {
    const html = render({ canPaste: true, pasteFailed: true })
    expect(html).toContain('role="status"')
    expect(html).toContain('Nie udało się wkleić.')
  })
})

describe('readLinkFromClipboard', () => {
  it('takes the link out of copied "text + link"', async () => {
    const clipboard = { readText: vi.fn().mockResolvedValue('Zobacz ten sernik! https://aniagotuje.pl/przepis/sernik') }
    await expect(readLinkFromClipboard(clipboard)).resolves.toBe('https://aniagotuje.pl/przepis/sernik')
  })

  it('falls back to the trimmed text when there is no link', async () => {
    const clipboard = { readText: vi.fn().mockResolvedValue('  pierogi ruskie \n') }
    await expect(readLinkFromClipboard(clipboard)).resolves.toBe('pierogi ruskie')
  })

  it('returns null for an empty clipboard or a refused read', async () => {
    await expect(readLinkFromClipboard({ readText: vi.fn().mockResolvedValue('   ') })).resolves.toBeNull()
    await expect(
      readLinkFromClipboard({ readText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) }),
    ).resolves.toBeNull()
  })
})
