import { describe, it, expect } from 'vitest'
import { buildContentSecurityPolicy, securityHeaders } from './security-headers'

describe('buildContentSecurityPolicy', () => {
  const csp = buildContentSecurityPolicy({ supabaseUrl: 'https://proj.supabase.co' })

  it('forbids framing with frame-ancestors none', () => {
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('allows the YouTube no-cookie embed host in frame-src', () => {
    expect(csp).toContain('frame-src https://www.youtube-nocookie.com')
  })

  it('allows the Supabase origin (https + wss) in connect-src for REST/auth/storage/realtime', () => {
    const connect = csp.split('; ').find((d) => d.startsWith('connect-src')) ?? ''
    expect(connect).toContain("'self'")
    expect(connect).toContain('https://proj.supabase.co')
    expect(connect).toContain('wss://proj.supabase.co')
  })

  it('allows hotlinked recipe photos over https in img-src', () => {
    const img = csp.split('; ').find((d) => d.startsWith('img-src')) ?? ''
    expect(img).toContain("'self'")
    expect(img).toContain('data:')
    expect(img).toContain('blob:')
    expect(img).toContain('https:')
  })

  it("omits 'unsafe-eval' in production and adds it only in dev (Turbopack HMR)", () => {
    const prod = buildContentSecurityPolicy({ isDev: false })
    const dev = buildContentSecurityPolicy({ isDev: true })
    expect(prod).not.toContain("'unsafe-eval'")
    expect(dev).toContain("'unsafe-eval'")
  })

  it('falls back to the production Supabase origin when the URL is missing or invalid', () => {
    expect(buildContentSecurityPolicy({ supabaseUrl: undefined })).toContain(
      'https://wvrlgddgdddwmgzbvtij.supabase.co',
    )
    expect(buildContentSecurityPolicy({ supabaseUrl: 'not-a-url' })).toContain(
      'https://wvrlgddgdddwmgzbvtij.supabase.co',
    )
  })
})

describe('securityHeaders', () => {
  it('returns the five required headers with the audit-specified values', () => {
    const map = new Map(securityHeaders({ supabaseUrl: 'https://proj.supabase.co' }))
    expect(map.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
    expect(map.get('X-Frame-Options')).toBe('DENY')
    expect(map.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(map.get('X-Content-Type-Options')).toBe('nosniff')
    expect(map.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains')
  })
})
