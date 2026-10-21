import { staticAssetPaths } from '../src/lib/static-assets'

// Production smoke check: every `/_next/static` file the public pages reference
// must load. A Worker version whose code and static assets come from different
// builds — what saving a secret in the Cloudflare dashboard deployed on
// 2026-10-22 — serves HTML naming files that 404: no CSS, ChunkLoadError on
// every page. A green Workers Build does not catch it. Run after every deploy
// and every secret change:
//
//   pnpm smoke:prod                         # https://zapiszprzepis.pl
//   pnpm smoke:prod https://<version>.workers.dev
//
// Exits 1 when a page or a file fails, so it can gate a script.

const BASE = (process.argv[2] ?? 'https://zapiszprzepis.pl').replace(/\/$/, '')
// Public pages: a guest gets them without a redirect to /login.
const PAGES = ['/', '/szukaj', '/login']

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

async function main(): Promise<void> {
  const failures: string[] = []
  const assets = new Set<string>()

  // A cache-buster per run, so the check never reads an HTML copy a CDN kept.
  const pages = await Promise.all(
    PAGES.map(async (page) => ({ page, ...(await get(`${BASE}${page}?cb=${Date.now()}`, { readBody: true })) })),
  )
  for (const { page, status, html = '' } of pages) {
    if (status !== 200) {
      failures.push(`page ${page} → ${status || 'unreachable'}`)
      continue
    }
    const paths = staticAssetPaths(html)
    if (paths.length === 0) failures.push(`page ${page} → no /_next/static files in its HTML`)
    for (const path of paths) assets.add(path)
  }

  const results = await Promise.all([...assets].map(async (path) => ({ path, ...(await get(`${BASE}${path}`)) })))
  for (const { path, status, type } of results) {
    // The Worker answers a missing file with its HTML 404 page; a 200 HTML
    // body in place of CSS/JS would be just as broken.
    if (status !== 200 || type.startsWith('text/html')) failures.push(`${path} → ${status} ${type}`)
  }

  console.log(`${BASE}: ${PAGES.length} pages, ${assets.size} static files checked`)
  if (failures.length > 0) {
    console.error(`✗ ${failures.length} failed:`)
    for (const f of failures) console.error(`  ${f}`)
    console.error(
      'Fix: Cloudflare → Workers & Pages → zapiszprzepis → Builds → Retry the latest master build, then run this again.',
    )
    process.exit(1)
  }
  console.log('✓ every page and static file loads')
}

main()
