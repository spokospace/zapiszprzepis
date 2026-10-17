import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// updateSession normally refreshes the Supabase cookie; here it just returns a
// passthrough response and no user, so the 301 branch is exercised on its own.
vi.mock('@/lib/supabase/proxy', () => ({
  updateSession: vi.fn(async () => ({ response: NextResponse.next(), user: null })),
}))

import { middleware } from './middleware'

function get(path: string) {
  return new NextRequest(`http://localhost${path}`)
}

describe('middleware — E01-S03b legacy /recipes/{slug} → /przepis/{slug} 301', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('permanently (301) redirects a single-segment legacy recipe URL', async () => {
    const res = await middleware(get('/recipes/tiramisu'))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('http://localhost/przepis/tiramisu')
  })

  it('preserves the query string across the redirect', async () => {
    const res = await middleware(get('/recipes/tiramisu?fav=1&in_favorites=1'))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('http://localhost/przepis/tiramisu?fav=1&in_favorites=1')
  })

  it('keeps the slug segment intact (no double-encoding)', async () => {
    const res = await middleware(get('/recipes/a%20b'))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('http://localhost/przepis/a%20b')
  })

  it('leaves the owner list /recipes untouched — not a 301 to /przepis', async () => {
    const res = await middleware(get('/recipes'))
    expect(res.status).not.toBe(301)
    expect(res.headers.get('location')).not.toContain('/przepis')
  })

  it('does not redirect a deeper /recipes/{slug}/... path to /przepis', async () => {
    const res = await middleware(get('/recipes/tiramisu/edit'))
    expect(res.status).not.toBe(301)
    expect(res.headers.get('location')).not.toContain('/przepis')
  })
})

describe('middleware — E01-S09 public category listing /przepisy/{kategoria}', () => {
  it('lets a guest open a category listing without a redirect', async () => {
    const res = await middleware(get('/przepisy/zupy'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('still sends a guest on the bare /przepisy to /login', async () => {
    const res = await middleware(get('/przepisy'))
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Fprzepisy')
  })
})
