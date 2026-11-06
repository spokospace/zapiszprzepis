/**
 * Checks a new Worker version once after it goes live. Runs on the five-minute cron, so it
 * also covers builds started by the recipe-files deploy hook, which no person watches and
 * which GitHub Actions cannot check (no minutes). It is the automatic part of `pnpm smoke:prod`:
 * recipe pages and `/szukaj` (served as files) must answer 200, and every `/_next/static` file
 * they name must load, the failure of 2026-10-22 (HTML naming files that 404).
 *
 * The result is a log line (the alert, read in Observability) and a record in R2. A failed
 * check is retried on the next runs, up to MAX_ATTEMPTS, since a deploy may need a minute.
 * Routes that render on the Worker (`/`, `/login`) are deliberately not probed: a CPU-limit
 * 503 there is the known load problem, and this check must not add load or noise to it.
 */
import { staticAssetPaths } from './static-assets'
import type { Fetch } from './search-console'
import { restBase, restHeaders, type CronEnv } from './worker-cron'

const MAX_ATTEMPTS = 3
const RECIPE_SAMPLE = 3
/** Cap on distinct static files fetched, so one run stays well under the subrequest limit. */
const MAX_ASSETS = 30
const RECORD_KEY = 'deploy-check/last.json'

export type DeployCheckRecord = { version: string; attempts: number; ok: boolean; at: string; failures: string[] }

export type DeployCheckEnv = Pick<
  CronEnv,
  'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY' | 'NEXT_PUBLIC_SITE_URL' | 'CF_VERSION_METADATA' | 'BACKUPS'
>

/** Whether this version still needs a check: none recorded, or the last one failed with attempts left. */
export function needsCheck(version: string, last: DeployCheckRecord | null): boolean {
  if (!last || last.version !== version) return true
  return !last.ok && last.attempts < MAX_ATTEMPTS
}

/** The page's failures and the static files it names. */
export async function readPage(base: string, path: string, fetchFn: Fetch): Promise<{ failures: string[]; assets: string[] }> {
  const res = await fetchFn(`${base}${path}`, { redirect: 'manual' })
  if (res.status !== 200) return { failures: [`${path} → ${res.status}`], assets: [] }
  const assets = staticAssetPaths(await res.text())
  return { failures: assets.length === 0 ? [`${path} → no /_next/static files in its HTML`] : [], assets }
}

/** Failures for the distinct files, fetched together. The pages share most of them, and a free-plan run allows 50 subrequests. */
export async function checkAssets(base: string, assets: string[], fetchFn: Fetch): Promise<string[]> {
  const results = await Promise.all(
    [...new Set(assets)].slice(0, MAX_ASSETS).map(async (asset) => {
      const file = await fetchFn(`${base}${asset}`)
      const type = file.headers.get('content-type') ?? ''
      await file.body?.cancel()
      // The Worker answers a missing file with its HTML 404 page; a 200 HTML body in place of CSS/JS is as broken.
      return file.status !== 200 || type.startsWith('text/html') ? `${asset} → ${file.status} ${type}` : null
    }),
  )
  return results.filter((failure): failure is string => failure !== null)
}

async function sampleSlugs(env: DeployCheckEnv, fetchFn: Fetch): Promise<string[]> {
  // The oldest recipes: every one of them has a file, so a 200 does not depend on the Worker.
  const res = await fetchFn(
    `${restBase(env)}/rest/v1/public_recipes?select=slug&order=created_at.asc&limit=${RECIPE_SAMPLE}`,
    { headers: restHeaders(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
  )
  if (!res.ok) throw new Error(`recipe sample: Supabase responded ${res.status}`)
  return ((await res.json()) as { slug: string }[]).map((r) => r.slug)
}

/** Never throws: it runs inside the scheduled handler, and the log line is the alert. */
export async function runPostDeployCheck(env: DeployCheckEnv, fetchFn: Fetch = fetch, now: Date = new Date()): Promise<void> {
  const version = env.CF_VERSION_METADATA?.id
  const base = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  const bucket = env.BACKUPS
  if (!version || !base || !bucket?.get) return
  try {
    const stored = await bucket.get(RECORD_KEY)
    const last = stored ? ((await stored.json()) as DeployCheckRecord) : null
    if (!needsCheck(version, last)) return

    const failures: string[] = []
    const paths = ['/szukaj', ...(await sampleSlugs(env, fetchFn)).map((slug) => `/przepis/${slug}`)]
    const pages = await Promise.all(paths.map((path) => readPage(base, path, fetchFn)))
    failures.push(...pages.flatMap((page) => page.failures), ...(await checkAssets(base, pages.flatMap((page) => page.assets), fetchFn)))

    const attempts = last?.version === version ? last.attempts + 1 : 1
    const record: DeployCheckRecord = { version, attempts, ok: failures.length === 0, at: now.toISOString(), failures }
    await bucket.put(RECORD_KEY, JSON.stringify(record), { httpMetadata: { contentType: 'application/json' } })
    if (record.ok) console.log(`post-deploy: version ${version} ok (${paths.length} pages and their static files)`)
    else console.error(`post-deploy: version ${version} FAILED (attempt ${attempts}/${MAX_ATTEMPTS}): ${failures.join('; ')}`)
  } catch (error) {
    console.error('post-deploy: check could not run', error)
  }
}
