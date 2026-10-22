import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`)
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  getSignedInUser: vi.fn(),
  createSupabaseServerClient: vi.fn(async () => ({})),
}))
vi.mock('@/lib/full-access', () => ({ getFullAccess: vi.fn() }))
vi.mock('@/app/components/access-code-gate', () => ({
  AccessCodeGate: ({ notice, unlocked }: { notice?: boolean; unlocked?: ReactNode }) =>
    createElement('div', { 'data-testid': 'gate', 'data-notice': String(notice) }, unlocked),
}))
vi.mock('./add-recipe-panel', () => ({
  AddRecipePanel: ({ error, autoFocus }: { error?: string | null; autoFocus?: boolean }) =>
    createElement('div', {
      'data-testid': 'panel',
      'data-error': String(error ?? null),
      'data-autofocus': String(autoFocus),
    }),
}))

import { getSignedInUser } from '@/lib/supabase/server'
import { getFullAccess } from '@/lib/full-access'
import AddRecipePage, { metadata } from './page'

async function render(add_error?: string) {
  return renderToStaticMarkup(await AddRecipePage({ searchParams: Promise.resolve({ add_error }) }))
}

describe('/dodaj page (E01-S10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSignedInUser).mockResolvedValue({ id: 'u1' } as never)
  })

  it('shows the add panel to a user with full access, with the error from the URL', async () => {
    vi.mocked(getFullAccess).mockResolvedValue(true)
    const html = await render('invalid_url')
    expect(html).toMatch(/<h1[^>]*>Dodaj przepis<\/h1>/)
    expect(html).toContain('data-testid="panel"')
    expect(html).toContain('data-error="invalid_url"')
    expect(html).not.toContain('data-testid="gate"')
  })

  it('shows the code gate (3c) without full access, unlocking into the same panel', async () => {
    vi.mocked(getFullAccess).mockResolvedValue(false)
    const html = await render()
    expect(html).toContain('data-testid="gate"')
    expect(html).toContain('data-notice="false"')
    expect(html).toContain('data-autofocus="true"')
  })

  it('explains the gate when a blocked add sent the user here', async () => {
    vi.mocked(getFullAccess).mockResolvedValue(false)
    expect(await render('no_access')).toContain('data-notice="true"')
  })

  it('sends a guest to login and back to /dodaj', async () => {
    vi.mocked(getSignedInUser).mockResolvedValue(null)
    vi.mocked(getFullAccess).mockResolvedValue(false)
    await expect(render()).rejects.toThrow('REDIRECT /login?next=%2Fdodaj')
  })

  it('stays out of search indexes', () => {
    expect(metadata.robots).toEqual({ index: false })
  })
})
