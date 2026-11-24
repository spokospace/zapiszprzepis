/**
 * Checks a new Worker version once after it goes live. Runs on the five-minute cron, so it
 * also covers builds started by the recipe-files deploy hook, which no person watches and
 * which GitHub Actions cannot check (no minutes). It is the automatic part of `pnpm smoke:prod`:
 * recipe pages and `/szukaj` (served as files) must answer 200, and every `/_next/static` file
 * they name must load, the failure of 2026-10-22 (HTML naming files that 404). The recipes come
 * from `/sitemap.xml`, which must list some: from 2026-11-11 it listed none, unnoticed.
 *
 * The result is a log line (the alert, read in Observability) and a record in R2. A failed
 * check is retried on the next runs, up to MAX_ATTEMPTS, since a deploy may need a minute.
 * Routes that render on the Worker (`/`, `/login`) are deliberately not probed: a CPU-limit
 * 503 there is the known load problem, and this check must not add load or noise to it.
 */
import { staticAssetPaths } from './static-assets'
import { sitemapRecipePaths } from './smoke-attempts'
import type { Fetch } from './search-console'
import type { CronEnv } from './worker-cron'

const MAX_ATTEMPTS = 3
const RECIPE_SAMPLE = 3
/** Cap on distinct static files fetched, so one run stays well under the subrequest limit. */
const MAX_ASSETS = 30
const RECORD_KEY = 'deploy-check/last.json'

export type DeployCheckRecord = { version: string; attempts: number; ok: boolean; at: string; failures: string[] }

export type DeployCheckEnv = Pick<CronEnv, 'NEXT_PUBLIC_SITE_URL' | 'CF_VERSION_METADATA' | 'BACKUPS'>

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

/**
 * The sitemap's failures and the first recipes it lists. Those are the oldest, and every one of
 * them has a file, so a 200 does not depend on the Worker. A sitemap without recipes is a failure.
 */
export async function readSitemap(base: string, fetchFn: Fetch): Promise<{ failures: string[]; paths: string[] }> {
  const res = await fetchFn(`${base}/sitemap.xml`, { redirect: 'manual' })
  if (res.status !== 200) return { failures: [`/sitemap.xml → ${res.status}`], paths: [] }
  const paths = sitemapRecipePaths(await res.text()).slice(0, RECIPE_SAMPLE)
  return { failures: paths.length === 0 ? ['/sitemap.xml → lists no recipes'] : [], paths }
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

    const sitemap = await readSitemap(base, fetchFn)
    const paths = ['/szukaj', ...sitemap.paths]
    const pages = await Promise.all(paths.map((path) => readPage(base, path, fetchFn)))
    const failures = [
      ...sitemap.failures,
      ...pages.flatMap((page) => page.failures),
      ...(await checkAssets(base, pages.flatMap((page) => page.assets), fetchFn)),
    ]

    const attempts = last?.version === version ? last.attempts + 1 : 1
    const record: DeployCheckRecord = { version, attempts, ok: failures.length === 0, at: now.toISOString(), failures }
    await bucket.put(RECORD_KEY, JSON.stringify(record), { httpMetadata: { contentType: 'application/json' } })
    if (record.ok) console.log(`post-deploy: version ${version} ok (the sitemap, ${paths.length} pages and their static files)`)
    else console.error(`post-deploy: version ${version} FAILED (attempt ${attempts}/${MAX_ATTEMPTS}): ${failures.join('; ')}`)
  } catch (error) {
    console.error('post-deploy: check could not run', error)
  }
}
