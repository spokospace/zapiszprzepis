import { staticAssetPaths } from '../src/lib/static-assets'
import { attemptFailure } from '../src/lib/smoke-attempts'

// Production smoke check: every `/_next/static` file the public pages reference
// must load. A Worker version whose code and static assets come from different
// builds — what saving a secret in the Cloudflare dashboard deployed on
// 2026-10-22 — serves HTML naming files that 404: no CSS, ChunkLoadError on
// every page. A green Workers Build does not catch it.
// Each page is loaded ATTEMPTS times and must answer 200 every time: the same
// day the Worker answered 503 (error 1102, CPU limit) to up to ~40% of requests,
// which one request per page let through. Run after every deploy and every
// secret change:
//
//   pnpm smoke:prod                         # https://zapiszprzepis.pl
//   pnpm smoke:prod https://<version>.workers.dev
//
// Exits 1 when a page or a file fails, so it can gate a script.

const BASE = (process.argv[2] ?? 'https://zapiszprzepis.pl').replace(/\/$/, '')
// Public pages: a guest gets them without a redirect to /login. Signed-in and
// API routes are not probed; a Worker-wide fault shows up on these as well.
const PAGES = ['/', '/szukaj', '/login']
// At a 40% failure rate, ten 200s in a row happen 0.6% of the time.
const ATTEMPTS = 10
// Sequential, spaced attempts per page: an intermittent fault, not a burst.
const GAP_MS = 300

interface Fetched {
  status: number
  type: string
  /** The body, read only when asked for; a file's is dropped unread. */
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

/** The page's status on every attempt, and the first 200 body (none when no attempt succeeded). */
async function getRepeatedly(page: string): Promise<{ statuses: number[]; html?: string }> {
  const statuses: number[] = []
  let html: string | undefined
  for (let i = 0; i < ATTEMPTS; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, GAP_MS))
    // A cache-buster per attempt, so the check never reads an HTML copy a CDN kept.
    const res = await get(`${BASE}${page}?cb=${Date.now()}-${i}`, { readBody: html === undefined })
    statuses.push(res.status)
    if (res.status === 200 && html === undefined) html = res.html
  }
  return { statuses, html }
}

async function main(): Promise<void> {
  const failures: string[] = []
  const assets = new Set<string>()

  const pages = await Promise.all(PAGES.map(async (page) => ({ page, ...(await getRepeatedly(page)) })))
  for (const { page, statuses, html } of pages) {
    const failure = attemptFailure(page, statuses)
    if (failure) failures.push(failure)
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
  if (failures.length > 0) {
    console.error(`✗ ${failures.length} failed:`)
    for (const f of failures) console.error(`  ${f}`)
    console.error(
      'Fix: a missing static file → Cloudflare → Workers & Pages → zapiszprzepis → Builds → Retry the latest master build.\n' +
        'Pages failing on some attempts (503) → open one in a browser: "error code: 1102" is the Worker exceeding ' +
        'its CPU limit, which a redeploy does not fix. Then run this again.',
    )
    process.exit(1)
  }
  console.log('✓ every page and static file loads')
}

main()
