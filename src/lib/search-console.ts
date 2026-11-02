// Google Search Console client for the daily sync (syncSearchConsole in
// src/lib/worker-cron.ts).
//
// Bundled into the Worker entrypoint, so nothing here may import `server-only` or
// anything Next-specific. Auth is a service account: a signed JWT is exchanged for
// an access token (RS256 via WebCrypto), which is enough for the read-only
// Search Analytics API.

export const GSC_SITE = 'sc-domain:zapiszprzepis.pl'
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/**
 * How many rows per day and dimension are fetched: the long tail is noise for this
 * report, and a small response keeps the cron inside the free plan's CPU budget.
 * Google returns the rows sorted by clicks, so this is the day's top.
 */
export const TOP_ROWS_PER_DAY = 500
/** Days re-fetched on every run. Search Console fills the last two or three days in late. */
export const SYNC_DAYS = 5
/** Rows older than this are deleted on each run (reads never look back more than 366 days). */
export const RETENTION_DAYS = 400
const MAX_KEY_LENGTH = 500

export const SEARCH_DIMENSIONS = ['query', 'page'] as const
export type SearchDimension = (typeof SEARCH_DIMENSIONS)[number]

export interface ServiceAccount {
  clientEmail: string
  privateKey: string
}

export interface DailyRow {
  day: string
  dimension: SearchDimension
  key: string
  clicks: number
  impressions: number
  position: number
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>

/** The two fields we need from a service-account key file, or null when it is not one. */
export function parseServiceAccount(json: string | undefined): ServiceAccount | null {
  if (!json) return null
  try {
    const key = JSON.parse(json) as Record<string, unknown>
    if (typeof key.client_email !== 'string' || typeof key.private_key !== 'string') return null
    return { clientEmail: key.client_email, privateKey: key.private_key }
  } catch {
    return null
  }
}

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const base64urlJson = (value: unknown): string => base64url(new TextEncoder().encode(JSON.stringify(value)))

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
}

/** A signed JWT asking Google for a read-only Search Console token, valid for an hour. */
export async function signedAssertion(account: ServiceAccount, nowSeconds: number): Promise<string> {
  const unsigned = `${base64urlJson({ alg: 'RS256', typ: 'JWT' })}.${base64urlJson({
    iss: account.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  })}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(account.privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  return `${unsigned}.${base64url(new Uint8Array(signature))}`
}

export async function accessToken(account: ServiceAccount, fetchFn: Fetch, nowSeconds: number): Promise<string> {
  const res = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: await signedAssertion(account, nowSeconds),
    }),
  })
  if (!res.ok) throw new Error(`token: Google responded ${res.status}`)
  const body = (await res.json()) as { access_token?: unknown }
  if (typeof body.access_token !== 'string') throw new Error('token: no access_token in the response')
  return body.access_token
}

const isoDay = (now: Date, daysAgo: number): string => new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10)

/** The days to fetch (YYYY-MM-DD), oldest first, ending yesterday. */
export function syncDays(now: Date, days = SYNC_DAYS): string[] {
  return Array.from({ length: days }, (_, i) => isoDay(now, days - i))
}

/** Rows on days before this one (YYYY-MM-DD) are past retention. */
export function retentionCutoff(now: Date): string {
  return isoDay(now, RETENTION_DAYS)
}

interface ReportRow {
  keys?: unknown
  clicks?: unknown
  impressions?: unknown
  position?: unknown
}

/** One day's Search Analytics report by `dimension`: its top TOP_ROWS_PER_DAY rows. */
export async function fetchReport(token: string, dimension: SearchDimension, day: string, fetchFn: Fetch): Promise<ReportRow[]> {
  const res = await fetchFn(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: day,
        endDate: day,
        dimensions: [dimension],
        type: 'web',
        dataState: 'all',
        rowLimit: TOP_ROWS_PER_DAY,
      }),
    },
  )
  if (!res.ok) throw new Error(`${dimension} report for ${day}: Google responded ${res.status}`)
  const body = (await res.json()) as { rows?: unknown }
  return Array.isArray(body.rows) ? (body.rows as ReportRow[]) : []
}

/** A page URL as the site path we store (`/przepis/sernik`); null when it is not a URL. */
function pagePath(url: string): string | null {
  try {
    return decodeURI(new URL(url).pathname)
  } catch {
    return null
  }
}

const whole = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

/** One day's report rows as table rows, with page URLs reduced to their path. */
export function toDailyRows(rows: ReportRow[], dimension: SearchDimension, day: string): DailyRow[] {
  const byKey = new Map<string, DailyRow>()
  for (const row of rows) {
    if (!Array.isArray(row.keys) || row.keys.length !== 1 || typeof row.keys[0] !== 'string') continue
    const key = dimension === 'page' ? pagePath(row.keys[0]) : row.keys[0].trim()
    if (!key || key.length > MAX_KEY_LENGTH) continue

    const clicks = whole(row.clicks)
    const impressions = whole(row.impressions)
    const position = Number.isFinite(Number(row.position)) ? Math.max(0, Number(row.position)) : 0
    const seen = byKey.get(key)
    if (seen) {
      // Two URLs with the same path (e.g. with and without a query string): merge them.
      const total = seen.impressions + impressions
      seen.position = total > 0 ? (seen.position * seen.impressions + position * impressions) / total : 0
      seen.clicks += clicks
      seen.impressions = total
    } else {
      byKey.set(key, { day, dimension, key, clicks, impressions, position })
    }
  }
  return [...byKey.values()]
}
