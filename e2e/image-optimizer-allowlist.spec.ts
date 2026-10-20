import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * Request-level guard for the image-optimizer allowlist (#307; follows #303, #131).
 *
 * `src/lib/image-remote-patterns.test.ts` checks the pattern the config *returns*;
 * this checks the pattern the running app actually *enforces* on `/_next/image`.
 * If `next.config.ts` ever goes back to `hostname: '**'`, the optimizer is an open
 * image proxy again (#131) — every 400 below becomes a 200 and this fails.
 *
 * Runs unauthenticated and writes nothing: it only GETs `/_next/image` and the
 * homepage. The "allowed" case discovers a real archived cover the app emits, so
 * no fixtures or seeded rows are needed.
 */

// Mirrors image-remote-patterns.ts: the Worker `vars` don't exist under `next dev`,
// so a missing NEXT_PUBLIC_SUPABASE_URL falls back to the production project.
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://wvrlgddgdddwmgzbvtij.supabase.co'
const HOST = new URL(SUPABASE).host

// The optimizer validates width and quality too, so send valid ones on every
// request and leave the source URL as the only thing under test.
const optimize = (request: APIRequestContext, url: string) =>
  request.get(`/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`)

// The off-list URLs from #303's QA evidence: a foreign host, another Supabase
// project, another bucket on our project, a non-public object path, and plain http.
const OFF_LIST: [url: string, label: string][] = [
  ['https://any-host.example/huge.jpg', 'a foreign host'],
  ['https://other-project.supabase.co/storage/v1/object/public/recipe-images/x.jpg', 'another Supabase project'],
  [`${SUPABASE}/storage/v1/object/public/avatars/user-1.jpg`, 'another bucket on our project'],
  [`${SUPABASE}/storage/v1/object/sign/recipe-images/x.jpg`, 'a non-public object path'],
  [`http://${HOST}/storage/v1/object/public/recipe-images/x.jpg`, 'plain http'],
]

test.describe('/_next/image allowlist (#307)', () => {
  for (const [url, label] of OFF_LIST) {
    test(`refuses ${label}`, async ({ request }) => {
      const res = await optimize(request, url)
      expect(res.status(), `the optimizer must refuse ${label}: ${url}`).toBe(400)
    })
  }

  test('serves an archived recipe-images photo', async ({ request }) => {
    // Pick a live archived cover straight from the app's own markup.
    const html = await (await request.get('/')).text()
    const match = html.match(/\/_next\/image\?url=([^"&\\]*recipe-images[^"&\\]*)/)
    expect(match, 'the homepage should render at least one optimized recipe-images cover').toBeTruthy()

    const source = decodeURIComponent(match![1])
    const target = new URL(source)
    expect(target.host, `discovered cover must be on our Supabase host: ${source}`).toBe(HOST)
    expect(target.pathname.startsWith('/storage/v1/object/public/recipe-images/')).toBe(true)

    const res = await optimize(request, source)
    expect(res.status(), `the optimizer must serve the archived cover: ${source}`).toBe(200)
    expect(res.headers()['content-type']).toContain('image/')
  })
})
