import { describe, it, expect, vi, beforeAll } from 'vitest'
import {
  GSC_SITE,
  parseServiceAccount,
  retentionCutoff,
  signedAssertion,
  syncDays,
  toDailyRows,
  TOP_ROWS_PER_DAY,
  type ServiceAccount,
} from './search-console'
import { syncSearchConsole } from './worker-cron'

let account: ServiceAccount
let publicKey: CryptoKey

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const b64 = btoa(String.fromCharCode(...der)).replace(/(.{64})/g, '$1\n')
  account = { clientEmail: 'sync@project.iam.gserviceaccount.com', privateKey: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n` }
  publicKey = pair.publicKey
})

const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))

describe('parseServiceAccount', () => {
  it('reads client_email and private_key from a key file', () => {
    expect(parseServiceAccount(JSON.stringify({ client_email: 'a@b', private_key: 'k', type: 'service_account' }))).toEqual({
      clientEmail: 'a@b',
      privateKey: 'k',
    })
  })

  it('returns null for a missing, broken or incomplete key', () => {
    expect(parseServiceAccount(undefined)).toBeNull()
    expect(parseServiceAccount('not json')).toBeNull()
    expect(parseServiceAccount(JSON.stringify({ client_email: 'a@b' }))).toBeNull()
  })
})

describe('signedAssertion', () => {
  it('builds a read-only Search Console JWT that verifies with the account key', async () => {
    const jwt = await signedAssertion(account, 1_000)
    const [header, claims, signature] = jwt.split('.')
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(decode(claims)).toEqual({
      iss: account.clientEmail,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_000,
      exp: 4_600,
    })
    const sig = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, sig, new TextEncoder().encode(`${header}.${claims}`))
    expect(ok).toBe(true)
  })
})

describe('sync days and retention', () => {
  it('fetches the five days ending yesterday and prunes past 400 days', () => {
    const now = new Date('2026-11-02T04:00:00Z')
    expect(syncDays(now)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(retentionCutoff(now)).toBe('2025-09-28')
  })
})

describe('toDailyRows', () => {
  it('reduces page URLs to paths and merges URLs that share one, weighting position by impressions', () => {
    const rows = toDailyRows(
      [
        { keys: ['https://zapiszprzepis.pl/przepis/sernik'], clicks: 3, impressions: 10, position: 2 },
        { keys: ['https://zapiszprzepis.pl/przepis/sernik?utm=x'], clicks: 1, impressions: 30, position: 6 },
        { keys: ['https://zapiszprzepis.pl/przepis/%C5%BCurek'], clicks: 2, impressions: 5, position: 1 },
      ],
      'page',
      '2026-11-01',
    )
    expect(rows).toEqual([
      { day: '2026-11-01', dimension: 'page', key: '/przepis/sernik', clicks: 4, impressions: 40, position: 5 },
      { day: '2026-11-01', dimension: 'page', key: '/przepis/żurek', clicks: 2, impressions: 5, position: 1 },
    ])
  })

  it('skips malformed rows and over-long keys', () => {
    const rows = toDailyRows(
      [
        { keys: ['  sernik '], clicks: 1, impressions: 50, position: 3 },
        { keys: ['a', 'b'], clicks: 9 },
        { keys: [5], clicks: 9 },
        { keys: ['x'.repeat(501)], clicks: 9 },
      ],
      'query',
      '2026-11-01',
    )
    expect(rows).toEqual([{ day: '2026-11-01', dimension: 'query', key: 'sernik', clicks: 1, impressions: 50, position: 3 }])
  })
})

describe('syncSearchConsole', () => {
  const env = () => ({
    NEXT_PUBLIC_SUPABASE_URL: 'https://db.example/',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    GSC_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: account.clientEmail, private_key: account.privateKey }),
  })

  it('skips without the key file and never calls out', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchFn = vi.fn()
    await syncSearchConsole({ ...env(), GSC_SERVICE_ACCOUNT_JSON: undefined }, fetchFn)
    expect(fetchFn).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('skipped'))
  })

  it('asks Google for each day and dimension, upserts every row in one request, then prunes', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('https://oauth2')) return Response.json({ access_token: 'tok' })
      if (url.includes('searchAnalytics')) {
        const body = JSON.parse(String(init?.body))
        const key = body.dimensions[0] === 'page' ? 'https://zapiszprzepis.pl/przepis/sernik' : 'sernik'
        return Response.json({ rows: [{ keys: [key], clicks: 2, impressions: 7, position: 3 }] })
      }
      return new Response(null, { status: 201 })
    })

    await syncSearchConsole(env(), fetchFn, new Date('2026-11-02T04:00:00Z'))

    const reports = fetchFn.mock.calls.filter(([u]) => u.includes('searchAnalytics'))
    expect(reports).toHaveLength(10)
    expect(reports[0][0]).toContain(`/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`)
    expect((reports[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(String(reports[0][1]?.body))).toEqual({
      startDate: '2026-10-28',
      endDate: '2026-10-28',
      dimensions: ['query'],
      type: 'web',
      dataState: 'all',
      rowLimit: TOP_ROWS_PER_DAY,
    })

    const db = fetchFn.mock.calls.filter(([u]) => u.startsWith('https://db.example'))
    expect(db.map(([u, i]) => `${i?.method} ${u}`)).toEqual([
      'POST https://db.example/rest/v1/search_console_daily?on_conflict=day,dimension,key',
      'DELETE https://db.example/rest/v1/search_console_daily?day=lt.2025-09-28',
    ])
    const upsert = db[0][1]
    expect((upsert?.headers as Record<string, string>).Authorization).toBe('Bearer service')
    expect((upsert?.headers as Record<string, string>).Prefer).toContain('resolution=merge-duplicates')
    const rows = JSON.parse(String(upsert?.body))
    expect(rows).toHaveLength(10)
    expect(rows).toContainEqual({ day: '2026-11-01', dimension: 'page', key: '/przepis/sernik', clicks: 2, impressions: 7, position: 3 })
  })

  it('logs and swallows a Google error instead of throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchFn = vi.fn(async () => new Response(null, { status: 403 }))
    await expect(syncSearchConsole(env(), fetchFn)).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('token: Google responded 403'))
  })
})
