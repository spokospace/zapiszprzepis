import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/env', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  getSuabaseServiceRoleKey: () => 'service-role',
}))
const generateLink = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: { admin: { generateLink } } })),
}))
const verifyOtp = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { verifyOtp } })),
}))

import { createClient } from '@supabase/supabase-js'
import { GET } from './route'

function get(query = '') {
  return GET(new NextRequest(`http://localhost:3000/api/dev/login${query}`))
}

function enable(nodeEnv = 'development') {
  vi.stubEnv('NODE_ENV', nodeEnv)
  vi.stubEnv('DEV_LOGIN_ENABLED', '1')
  vi.stubEnv('DEV_LOGIN_EMAIL_FULL', 'qa-full@example.com')
  vi.stubEnv('DEV_LOGIN_EMAIL_FREE', 'qa-free@example.com')
}

function linkFor(confirmed = true) {
  generateLink.mockResolvedValue({
    data: {
      user: { id: 'qa-user-id', email_confirmed_at: confirmed ? '2026-10-01T00:00:00Z' : null },
      properties: { hashed_token: 'hash-123' },
    },
    error: null,
  })
}

describe('GET /api/dev/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyOtp.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('404s in a production build even with every flag set, without touching Supabase', async () => {
    enable('production')
    const res = await get('?as=full')
    expect(res.status).toBe(404)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('404s on a dev server when DEV_LOGIN_ENABLED is missing', async () => {
    enable()
    vi.stubEnv('DEV_LOGIN_ENABLED', undefined)
    expect((await get()).status).toBe(404)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('404s when the requested account email is not configured', async () => {
    enable()
    vi.stubEnv('DEV_LOGIN_EMAIL_FREE', undefined)
    expect((await get('?as=free')).status).toBe(404)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('signs in via a verified magic-link token and redirects to a safe next', async () => {
    enable()
    linkFor()
    const res = await get('?as=free&next=/ulubione')
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'qa-free@example.com' })
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'hash-123' })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/ulubione')
  })

  it('drops an off-site next', async () => {
    enable()
    linkFor()
    const res = await get('?next=//evil.com')
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('refuses an unconfirmed (just auto-created) user instead of signing it in', async () => {
    enable()
    linkFor(false)
    const res = await get()
    expect(res.status).toBe(409)
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('reports a failed verification instead of redirecting', async () => {
    enable()
    linkFor()
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired' } })
    const res = await get()
    expect(res.status).toBe(500)
  })
})
