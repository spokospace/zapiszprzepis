import { staticAssetPaths } from '../src/lib/static-assets'
import { classifyAttempts, type AttemptResult } from '../src/lib/smoke-attempts'

// Production smoke check: every `/_next/static` file the public pages reference
// must load. A Worker version whose code and static assets come from different
// builds — what saving a secret in the Cloudflare dashboard deployed on
// 2026-10-22 — serves HTML naming files that 404: no CSS, ChunkLoadError on
// every page. A green Workers Build does not catch it.
//
// Each page is loaded ATTEMPTS times. A 503 that is Cloudflare error 1102 (the
// Worker exceeding its CPU limit) is RETRIED with backoff: right after a deploy
// every isolate is cold, and a cold SSR render can briefly exceed the free-tier
// per-request CPU ceiling, clearing as the isolate warms. A 1102 that recovers
// within the retries is a transient cold-start — reported as a note, not a
// failure, so a healthy post-deploy window does not read as an outage. A 1102
// that is still failing after the retries, a non-1102 status, a missing/404
// static file, or a page that never answers 200 still fails — none of those
// warms away. Run after every deploy and every secret change:
//
//   pnpm smoke:prod                         # https://zapiszprzepis.pl
//   pnpm smoke:prod https://<version>.workers.dev
//
// Exits 1 when a page or a file hard-fails, so it can gate a script.

const BASE = (process.argv[2] ?? 'https://zapiszprzepis.pl').replace(/\/$/, '')
// Public pages: a guest gets them without a redirect to /login. Signed-in and
// API routes are not probed; a Worker-wide fault shows up on these as well.
const PAGES = ['/', '/szukaj', '/login']
const ATTEMPTS = 10
// Sequential, spaced attempts per page: an intermittent fault, not a burst.
const GAP_MS = 300
// Backoff before each retry of a 1102, giving the cold isolate time to warm.
const CPU_LIMIT_BACKOFF_MS = [700, 1500, 3000]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface Fetched {
  status: number
  type: string
  /** The body; for a page always read (to detect a 1102 and to extract assets), for a file dropped unread. */
  html?: string
}

/** Never throws: an unreachable URL is status 0. */
async function get(url: string, { readBody = false } = {}): Promise<Fetched> {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) })
    const fetched = { status: res.status, type: res.headers.get('content-type') ?? '' }
    if (readBody) return { ...fetched, html: await res.text() }
    await res.body?.cancel()
    return fetched
  } catch (err) {
    console.error(`  ${url}: ${err instanceof Error ? err.message : String(err)}`)
    return { status: 0, type: '' }
  }
}

/** A 503 whose body is Cloudflare's "error code: 1102" page — the Worker CPU limit, not another 503. */
function isCpuLimit(status: number, html: string | undefined): boolean {
  const body = html ?? ''
  return status === 503 && /\b1102\b/.test(body) && /error code/i.test(body)
}

/** One attempt, retrying a 1102 with backoff until it recovers or the backoffs run out. */
async function attempt(url: string): Promise<{ result: AttemptResult; html?: string }> {
  let recovered = false // a 1102 was seen before this attempt came good
  for (const delay of [0, ...CPU_LIMIT_BACKOFF_MS]) {
    if (delay > 0) await sleep(delay)
    const res = await get(url, { readBody: true })
    if (res.status === 200) return { result: { kind: 'ok', recovered }, html: res.html }
    if (!isCpuLimit(res.status, res.html)) return { result: { kind: 'error', status: res.status } }
    recovered = true // this one was a 1102; a later 200 would be a recovery
  }
  return { result: { kind: 'cpu-limit' } } // still a 1102 after every backoff
}

/** Every attempt's result, and the first 200 body (none when no attempt succeeded). */
async function getRepeatedly(page: string): Promise<{ results: AttemptResult[]; html?: string }> {
  const results: AttemptResult[] = []
  let html: string | undefined
  for (let i = 0; i < ATTEMPTS; i++) {
    if (i > 0) await sleep(GAP_MS)
    // A cache-buster per attempt, so the check never reads an HTML copy a CDN kept.
    const { result, html: body } = await attempt(`${BASE}${page}?cb=${Date.now()}-${i}`)
    results.push(result)
    if (result.kind === 'ok' && html === undefined) html = body
  }
  return { results, html }
}

async function main(): Promise<void> {
  const failures: string[] = []
  const notes: string[] = []
  const assets = new Set<string>()

  const pages = await Promise.all(PAGES.map(async (page) => ({ page, ...(await getRepeatedly(page)) })))
  for (const { page, results, html } of pages) {
    const { hardFailure, transientNote } = classifyAttempts(page, results)
    if (hardFailure) failures.push(hardFailure)
    if (transientNote) notes.push(transientNote)
    // Assets are read from a 200 body even when another attempt failed, so a
    // missing file is reported alongside the flaky page.
    if (html === undefined) continue
    const paths = staticAssetPaths(html)
    if (paths.length === 0) failures.push(`page ${page} → no /_next/static files in its HTML`)
    for (const path of paths) assets.add(path)
  }

  // One request per file is enough: Workers Static Assets serves /_next/static
  // without running the Worker (during the 2026-10-22 503s every file still loaded).
  const results = await Promise.all([...assets].map(async (path) => ({ path, ...(await get(`${BASE}${path}`)) })))
  for (const { path, status, type } of results) {
    // The Worker answers a missing file with its HTML 404 page; a 200 HTML
    // body in place of CSS/JS would be just as broken.
    if (status !== 200 || type.startsWith('text/html')) failures.push(`${path} → ${status} ${type}`)
  }

  console.log(`${BASE}: ${PAGES.length} pages × ${ATTEMPTS} attempts, ${assets.size} static files checked`)
  if (notes.length > 0) {
    console.warn('⚠ transient post-deploy cold-start (error 1102); the site still serves:')
    for (const n of notes) console.warn(`  ${n}`)
  }
  if (failures.length > 0) {
    console.error(`✗ ${failures.length} failed:`)
    for (const f of failures) console.error(`  ${f}`)
    console.error(
      'Fix: a missing static file → Cloudflare → Workers & Pages → zapiszprzepis → Builds → Retry the latest master build.\n' +
        'A 1102 still failing after the retries (Worker CPU limit, not a brief cold start) → read the Observability logs ' +
        'in the Cloudflare dashboard; a redeploy does not fix a CPU-limit fault. Then run this again.',
    )
    process.exit(1)
  }
  console.log('✓ every page and static file loads')
}

main()
