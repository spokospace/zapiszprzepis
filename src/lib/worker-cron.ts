// Jobs run by the deployed Worker's cron triggers. They live here rather than in
// custom-worker.ts so they are typechecked and unit-testable — custom-worker.ts is
// excluded from tsconfig because it imports the build-time `.open-next/worker.js`.
//
// Nothing here may import `server-only` or anything Next-specific: this code is
// bundled into the Worker entrypoint, outside the Next.js request path.

import { fetchFirecrawlLimit } from './api-limits'
import {
  accessToken,
  fetchReport,
  parseServiceAccount,
  retentionCutoff,
  SEARCH_DIMENSIONS,
  syncDays,
  toDailyRows,
  type Fetch,
} from './search-console'

// PostgREST caps a response at max_rows (1000 by default). Paging is not about
// today's volume — it is about the backup not silently truncating later.
const PAGE_SIZE = 1000

export const BACKUP_TABLES = ['recipes', 'recipe_shares'] as const

export type R2Bucket = {
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
}

export type CronEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  // Set with `wrangler secret put`; absent until someone does that.
  SUPABASE_SERVICE_ROLE_KEY?: string
  // R2 binding from wrangler.jsonc; absent until the bucket exists.
  BACKUPS?: R2Bucket
  // Google service-account key file (JSON) for Search Console; set with `wrangler secret put`.
  GSC_SERVICE_ACCOUNT_JSON?: string
  // Firecrawl key, the same Worker secret the extraction uses; read here for the credit balance.
  FIRECRAWL_API_KEY?: string
  // Second Inngest account's event key (#580 phase 3). When set, the failover
  // watchdog re-sends stale pending shares to it; absent = failover off.
  INNGEST_EVENT_KEY_2?: string
  // Minutes a share may stay pending on the primary before the watchdog re-sends
  // it to the secondary. Default 10; set as a Worker var to tune without a deploy.
  INNGEST_FAILOVER_WINDOW_MINUTES?: string
  // Workers Builds deploy hook; the URL is the credential. Absent = recipe files refresh only
  // with a code build.
  RECIPE_FILES_DEPLOY_HOOK?: string
  // Static assets binding, for the content version the deployed recipe files hold.
  ASSETS?: { fetch(url: string): Promise<Response> }
}

export function restHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` }
}

export function restBase(env: Pick<CronEnv, 'NEXT_PUBLIC_SUPABASE_URL'>): string {
  return env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
}

/**
 * Runs a real SELECT through PostgREST. `/auth/v1/health` is not enough — it answers
 * without touching Postgres, so it does not count as activity. RLS gives the anon role
 * an empty array (policies filter by `user_id = public.current_user_id()`, and
 * `auth.uid()` is null here), so the 200 is the signal, not the payload.
 */
export async function keepDatabaseAwake(env: CronEnv): Promise<void> {
  const res = await fetch(`${restBase(env)}/rest/v1/recipes?select=id&limit=1`, {
    headers: restHeaders(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  })

  if (!res.ok) {
    console.error(`keep-alive: Supabase responded ${res.status}`)
    return
  }
  console.log('keep-alive: Supabase database reached')
}

async function fetchAllRows(base: string, key: string, table: string): Promise<unknown[]> {
  const rows: unknown[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await fetch(
      `${base}/rest/v1/${table}?select=*&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: restHeaders(key) },
    )
    if (!res.ok) {
      throw new Error(`${table}: Supabase responded ${res.status}`)
    }

    const page = (await res.json()) as unknown[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

/**
 * Dumps the recipe tables to R2 as one JSON object per day.
 *
 * Reads with the service role, which bypasses RLS — a backup that only saw one
 * user's rows would be worse than none, because it would look like it worked.
 * Rows only: the archived images live in Supabase Storage and are not copied.
 *
 * Never throws. A failed backup must not retry-storm or take the scheduled run
 * down with it; the log line is the alert.
 */
export async function backupToR2(env: CronEnv): Promise<void> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = env.BACKUPS

  if (!key || !bucket) {
    console.error('backup: skipped — SUPABASE_SERVICE_ROLE_KEY or the BACKUPS binding is missing')
    return
  }

  const base = restBase(env)
  const takenAt = new Date().toISOString()

  try {
    const tables: Record<string, unknown[]> = {}
    for (const table of BACKUP_TABLES) {
      tables[table] = await fetchAllRows(base, key, table)
    }

    const objectKey = `recipes/${takenAt.slice(0, 10)}.json`
    await bucket.put(objectKey, JSON.stringify({ takenAt, tables }), {
      httpMetadata: { contentType: 'application/json' },
    })

    const counts = BACKUP_TABLES.map((t) => `${t}=${tables[t].length}`).join(' ')
    console.log(`backup: wrote ${objectKey} (${counts})`)
  } catch (e) {
    console.error(`backup: failed — ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Copies the Google Search Console report into public.search_console_daily: for each
 * of the last SYNC_DAYS days, the top queries and the top pages (one request per day
 * and dimension, run in parallel). Only once every report is in, the refreshed days
 * (and rows past RETENTION_DAYS) are deleted and the fresh rows inserted, so a key
 * that fell out of a day's top list does not keep its old numbers. If the insert
 * fails, those days stay empty until the next run fetches them again.
 *
 * Never throws: a failed sync must not take the scheduled run down with it; the log
 * line is the alert.
 */
export async function syncSearchConsole(env: CronEnv, fetchFn: Fetch = fetch, now = new Date()): Promise<void> {
  const account = parseServiceAccount(env.GSC_SERVICE_ACCOUNT_JSON)
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!account || !key) {
    console.error('search-console: skipped — GSC_SERVICE_ACCOUNT_JSON or SUPABASE_SERVICE_ROLE_KEY is missing or invalid')
    return
  }

  try {
    const token = await accessToken(account, fetchFn, Math.floor(now.getTime() / 1000))
    const days = syncDays(now)
    const reports = await Promise.all(
      days.flatMap((day) =>
        SEARCH_DIMENSIONS.map(async (dimension) => toDailyRows(await fetchReport(token, dimension, day, fetchFn), dimension, day)),
      ),
    )
    const rows = reports.flat()

    // An all-empty answer is far likelier to be lost access than five days without a
    // single search, so keep what is stored rather than clearing it.
    if (rows.length === 0) throw new Error('Google returned no rows for any day; nothing changed')

    const table = `${restBase(env)}/rest/v1/search_console_daily`
    const clear = await fetchFn(`${table}?or=(day.lt.${retentionCutoff(now)},day.gte.${days[0]})`, {
      method: 'DELETE',
      headers: { ...restHeaders(key), Prefer: 'return=minimal' },
    })
    if (!clear.ok) throw new Error(`clear: Supabase responded ${clear.status}`)

    const insert = await fetchFn(table, {
      method: 'POST',
      headers: { ...restHeaders(key), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    })
    if (!insert.ok) throw new Error(`insert: Supabase responded ${insert.status}`)

    console.log(`search-console: ${days[0]}..${days[days.length - 1]}, ${rows.length} rows`)
  } catch (e) {
    console.error(`search-console: failed — ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Copies each provider's remaining-plan figure into public.api_limit_snapshots, one row
 * per service (upserted by service). A provider that cannot be reached keeps its previous
 * row, so the admin screen shows an older "checked at" time instead of nothing.
 *
 * Never throws: a failed sync must not take the scheduled run down with it; the log line
 * is the alert.
 */
export async function syncApiLimits(env: CronEnv, fetchFn: Fetch = fetch): Promise<void> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    console.error('api-limits: skipped — SUPABASE_SERVICE_ROLE_KEY is missing')
    return
  }
  if (!env.FIRECRAWL_API_KEY) {
    console.error('api-limits: skipped — FIRECRAWL_API_KEY is missing')
    return
  }

  try {
    const snapshot = await fetchFirecrawlLimit(env.FIRECRAWL_API_KEY, fetchFn)
    const res = await fetchFn(`${restBase(env)}/rest/v1/api_limit_snapshots?on_conflict=service`, {
      method: 'POST',
      headers: {
        ...restHeaders(key),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{ ...snapshot, fetched_at: new Date().toISOString() }]),
    })
    if (!res.ok) throw new Error(`upsert: Supabase responded ${res.status}`)
    console.log(`api-limits: ${snapshot.service} ${snapshot.remaining}/${snapshot.total} ${snapshot.unit}`)
  } catch (e) {
    console.error(`api-limits: failed — ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Default minutes a share may stay pending on the primary before the re-send. */
const DEFAULT_FAILOVER_WINDOW_MINUTES = 10

/** Most shares re-sent in one watchdog run, so a backlog cannot stall the cron. */
const FAILOVER_BATCH = 50

/** Inngest's event API. The SDK POSTs here too; we call it directly (see below). */
const INNGEST_EVENT_BASE_URL = 'https://inn.gs'

type PendingShareRow = {
  id: number
  shared_url: string
  share_intent: { title?: string | null; text?: string | null; sourceType?: string } | null
  user_id: string
}

/**
 * Throttle watchdog (#580 phase 3). A `recipe/extract` event can be accepted by
 * the primary Inngest account while its run never starts — the account is over
 * its plan limit. The send succeeded, so nothing failed over, and the share sits
 * `pending`. This finds shares that went to the primary and have been pending
 * longer than the window, and re-sends them to the secondary account by POSTing
 * the event to Inngest's event API directly.
 *
 * Raw fetch, not the Inngest SDK: the SDK would bundle a second copy into the
 * Worker (the size cap is tight), and it is no help anyway when the account it
 * talks to is the one that is down. Runs from the Cloudflare cron, not an Inngest
 * cron, for the same reason — the watchdog must not depend on the primary Inngest
 * account, which is exactly what may be failing.
 *
 * Never throws: a failed watchdog must not take the scheduled run down; the log
 * line is the alert. Needs the service role (it reads and updates every user's
 * shares) and the secondary event key; absent either, it logs and skips.
 */
export async function failoverStalePendingShares(env: CronEnv, now: Date = new Date()): Promise<void> {
  const eventKey = env.INNGEST_EVENT_KEY_2
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!eventKey || !serviceKey) {
    console.log('failover-watchdog: skipped — INNGEST_EVENT_KEY_2 or SUPABASE_SERVICE_ROLE_KEY is missing')
    return
  }

  const windowMinutes = Number(env.INNGEST_FAILOVER_WINDOW_MINUTES) || DEFAULT_FAILOVER_WINDOW_MINUTES
  const cutoff = new Date(now.getTime() - windowMinutes * 60_000).toISOString()
  const base = restBase(env)

  try {
    const query =
      `${base}/rest/v1/recipe_shares` +
      `?status=eq.pending&inngest_account=eq.primary&created_at=lt.${encodeURIComponent(cutoff)}` +
      `&select=id,shared_url,share_intent,user_id&order=created_at.asc&limit=${FAILOVER_BATCH}`
    const res = await fetch(query, { headers: restHeaders(serviceKey) })
    if (!res.ok) throw new Error(`candidate query: Supabase responded ${res.status}`)
    const rows = (await res.json()) as PendingShareRow[]
    if (rows.length === 0) {
      console.log('failover-watchdog: no stale pending shares')
      return
    }

    let failedOver = 0
    for (const row of rows) {
      const intent = row.share_intent ?? {}
      const data = {
        shareId: row.id,
        sharedUrl: row.shared_url,
        sharedTitle: intent.title ?? undefined,
        sharedText: intent.text ?? undefined,
        // Stored at send time; web_blog is the safe default for rows written
        // before the source type was persisted — it runs the full scrape path.
        sourceType: intent.sourceType ?? 'web_blog',
        userId: row.user_id,
      }
      const sent = await fetch(`${INNGEST_EVENT_BASE_URL}/e/${eventKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ name: 'recipe/extract', data, ts: now.getTime() }]),
      })
      if (!sent.ok) {
        console.error(`failover-watchdog: secondary send for share ${row.id} responded ${sent.status}`)
        continue
      }
      // Mark it secondary so the next run does not re-send it. A failed update
      // only means a harmless re-send next run — the idempotency guard stops a
      // double extraction once either account completes the share.
      const marked = await fetch(`${base}/rest/v1/recipe_shares?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { ...restHeaders(serviceKey), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ inngest_account: 'secondary' }),
      })
      if (!marked.ok) console.error(`failover-watchdog: marking share ${row.id} secondary responded ${marked.status}`)
      failedOver++
    }
    console.log(`failover-watchdog: re-sent ${failedOver}/${rows.length} stale pending shares to the secondary`)
  } catch (e) {
    console.error(`failover-watchdog: failed — ${e instanceof Error ? e.message : String(e)}`)
  }
}
