import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// updateSession normally refreshes the Supabase cookie; here it just returns a
// passthrough response and no user, so the 301 branch is exercised on its own.
vi.mock('@/lib/supabase/proxy', () => ({
  updateSession: vi.fn(async () => ({ response: NextResponse.next(), user: null })),
}))

import { middleware, config } from './middleware'
import { updateSession } from '@/lib/supabase/proxy'

function get(path: string) {
  return new NextRequest(`http://localhost${path}`)
}

describe('middleware config.matcher — crawler endpoints bypass the gate', () => {
  const re = new RegExp(`^${config.matcher[0]}$`)
  it('does NOT match /robots.txt, /sitemap.xml or /llms.txt (served without the auth gate)', () => {
    expect(re.test('/robots.txt')).toBe(false)
    expect(re.test('/sitemap.xml')).toBe(false)
    expect(re.test('/llms.txt')).toBe(false)
  })
  it('still matches app pages that must pass through the gate', () => {
    expect(re.test('/przepisy/obiady')).toBe(true)
    expect(re.test('/ulubione')).toBe(true)
  })
})

describe('middleware — #363 Phase 2 .md alternates rewrite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rewrites /przepis/{slug}.md to its route handler (not a redirect, not /login)', async () => {
    const res = await middleware(get('/przepis/sernik.md'))
    expect(res.status).not.toBe(307) // not a redirect to /login
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-rewrite')).toContain('/przepis/sernik/md')
  })

  it('rewrites /przepisy/{kategoria}.md to its route handler', async () => {
    const res = await middleware(get('/przepisy/ciasta.md'))
    expect(res.headers.get('x-middleware-rewrite')).toContain('/przepisy/ciasta/md')
  })

  it('does not rewrite a normal recipe page', async () => {
    const res = await middleware(get('/przepis/sernik'))
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('301s a legacy /recipes/{slug}.md to the canonical .md first', async () => {
    const res = await middleware(get('/recipes/sernik.md'))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('http://localhost/przepis/sernik.md')
  })
})

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

describe('middleware — dev-only QA sign-in /api/dev/login', () => {
  it('lets a guest reach the route (it opens the session itself; the route gates itself)', async () => {
    const res = await middleware(get('/api/dev/login?as=free'))
    expect(res.headers.get('location')).toBeNull()
  })
})

describe('middleware — one-time gender choice for accounts from before screen 3b', () => {
  /** A signed-in session whose profiles_private read returns `result`. */
  function signedIn(result: { data: { gender: string | null } | null; error: unknown }) {
    const maybeSingle = vi.fn(async () => result)
    const supabase = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })) }
    vi.mocked(updateSession).mockResolvedValueOnce({
      response: NextResponse.next(),
      user: { id: 'u1' },
      supabase,
    } as never)
    return supabase
  }

  it('sends a signed-in user without a gender to /witaj, coming back to the page', async () => {
    signedIn({ data: null, error: null })
    const res = await middleware(get('/przepis/sernik?from=szukaj'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/witaj?next=%2Fprzepis%2Fsernik%3Ffrom%3Dszukaj')
  })

  it('remembers a known gender in a cookie and lets the page through', async () => {
    signedIn({ data: { gender: 'female' }, error: null })
    const res = await middleware(get('/'))
    expect(res.headers.get('location')).toBeNull()
    expect(res.cookies.get('zp-gender')?.value).toBe('u1')
  })

  it('skips the read once the cookie names this user', async () => {
    const supabase = signedIn({ data: null, error: null })
    const req = get('/')
    req.cookies.set('zp-gender', 'u1')
    const res = await middleware(req)
    expect(res.headers.get('location')).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('fails open when the read errors — no redirect, no cookie', async () => {
    signedIn({ data: null, error: { code: '42P01' } })
    const res = await middleware(get('/'))
    expect(res.headers.get('location')).toBeNull()
    expect(res.cookies.get('zp-gender')).toBeUndefined()
  })

  it('never detours from /witaj itself', async () => {
    const supabase = signedIn({ data: null, error: null })
    const res = await middleware(get('/witaj?next=%2F'))
    expect(res.headers.get('location')).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('middleware — a session check that could not decide is not a guest', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lets a screen behind login through, for its own check to retry', async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      response: NextResponse.next(),
      user: null,
      authTransient: true,
    } as never)
    const res = await middleware(get('/powiadomienia'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('still sends a real guest to /login', async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      response: NextResponse.next(),
      user: null,
      authTransient: false,
    } as never)
    const res = await middleware(get('/powiadomienia'))
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Fpowiadomienia')
  })
})
