import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AuthenticatedError from '@/app/(authenticated)/error'
import PrzepisError from '@/app/przepis/error'
import RootError from '@/app/error'
import GlobalError from '@/app/global-error'

const error = new Error('boom')

describe('error boundaries — shared RouteErrorFallback', () => {
  it("pass Next's retry through unchanged", () => {
    const retry = vi.fn()
    expect(PrzepisError({ error, retry }).props.retry).toBe(retry)
    expect(AuthenticatedError({ error, retry }).props.retry).toBe(retry)
    expect(RootError({ error, retry }).props.retry).toBe(retry)
  })

  it('sends any visitor home from a page without its own boundary', () => {
    const html = renderToStaticMarkup(createElement(RootError, { error, retry: vi.fn() }))
    expect(html).toContain('href="/"')
    expect(html).not.toContain('href="/recipes"')
  })

  it('renders its own document when the root layout itself failed', () => {
    const html = renderToStaticMarkup(createElement(GlobalError, { error, retry: vi.fn() }))
    expect(html).toMatch(/^<html lang="pl"/)
    expect(html).toContain('<body')
    expect(html).toContain('href="/"')
    expect(html).toContain('Spróbuj ponownie')
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
