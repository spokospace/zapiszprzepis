import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AuthenticatedError from '@/app/(authenticated)/error'
import PrzepisError from '@/app/przepis/error'

const error = new Error('boom')

describe('error boundaries — shared RouteErrorFallback', () => {
  it("pass Next's retry through unchanged", () => {
    const retry = vi.fn()
    expect(PrzepisError({ error, retry }).props.retry).toBe(retry)
    expect(AuthenticatedError({ error, retry }).props.retry).toBe(retry)
  })

  it('sends a guest home from the public recipe page, not to the owner-only list', () => {
    const html = renderToStaticMarkup(createElement(PrzepisError, { error, retry: vi.fn() }))
    expect(html).toContain('href="/"')
    expect(html).not.toContain('href="/recipes"')
    expect(html).toContain('Spróbuj ponownie')
  })

  it("keeps the authenticated screens' link back to the recipe list", () => {
    const html = renderToStaticMarkup(createElement(AuthenticatedError, { error, retry: vi.fn() }))
    expect(html).toContain('href="/recipes"')
    expect(html).toContain('Wróć do przepisów')
  })
})
