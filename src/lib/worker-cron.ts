// Jobs run by the deployed Worker's cron triggers. They live here rather than in
// custom-worker.ts so they are typechecked and unit-testable — custom-worker.ts is
// excluded from tsconfig because it imports the build-time `.open-next/worker.js`.
//
// Nothing here may import `server-only` or anything Next-specific: this code is
// bundled into the Worker entrypoint, outside the Next.js request path.

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
}

function restHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` }
}

function restBase(env: CronEnv): string {
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
