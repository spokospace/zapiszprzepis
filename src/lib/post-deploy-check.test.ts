import { describe, expect, it, vi } from 'vitest'
import { checkAssets, readPage, needsCheck, runPostDeployCheck, type DeployCheckRecord } from './post-deploy-check'

const record = (over: Partial<DeployCheckRecord>): DeployCheckRecord => ({
  version: 'v1',
  attempts: 1,
  ok: true,
  at: '2026-11-06T12:00:00Z',
  failures: [],
  ...over,
})

describe('needsCheck', () => {
  it('checks a version never seen, or a new one', () => {
    expect(needsCheck('v1', null)).toBe(true)
    expect(needsCheck('v2', record({}))).toBe(true)
  })
  it('stops once a version passed', () => {
    expect(needsCheck('v1', record({ ok: true }))).toBe(false)
  })
  it('retries a failure until the attempts run out', () => {
    expect(needsCheck('v1', record({ ok: false, attempts: 2 }))).toBe(true)
    expect(needsCheck('v1', record({ ok: false, attempts: 3 }))).toBe(false)
  })
})

const HTML = '<link href="/_next/static/css/a.css"><script src="/_next/static/chunks/b.js"></script>'
const page = (html = HTML) => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })
const file = (type: string, status = 200) => new Response('x', { status, headers: { 'content-type': type } })

describe('readPage and checkAssets', () => {
  const run = async (fetchFn: unknown) => {
    const { failures, assets } = await readPage('https://x.test', '/p', fetchFn as never)
    return [...failures, ...(await checkAssets('https://x.test', assets, fetchFn as never))]
  }
  it('passes when the page and every file it names load', async () => {
    const fetchFn = vi.fn(async (url: string) => (url.endsWith('/p') ? page() : file(url.endsWith('.css') ? 'text/css' : 'text/javascript')))
    expect(await run(fetchFn)).toEqual([])
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })
  it('fetches a file shared by several pages once', async () => {
    const fetchFn = vi.fn(async () => file('text/css'))
    await checkAssets('https://x.test', ['/_next/static/a.css', '/_next/static/a.css'], fetchFn as never)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
  it('reports a missing file and an HTML 200 in place of a script', async () => {
    const fetchFn = vi.fn(async (url: string) => (url.endsWith('/p') ? page() : url.endsWith('.css') ? file('text/html', 404) : file('text/html')))
    expect(await run(fetchFn)).toEqual([
      '/_next/static/chunks/b.js → 200 text/html',
      '/_next/static/css/a.css → 404 text/html',
    ])
  })
  it('reports a page that does not answer 200 or names no files', async () => {
    expect(await run(async () => new Response('', { status: 503 }))).toEqual(['/p → 503'])
    expect(await run(async () => page('<p>no assets</p>'))).toEqual(['/p → no /_next/static files in its HTML'])
  })
})

describe('runPostDeployCheck', () => {
  function env(stored: DeployCheckRecord | null) {
    const put = vi.fn<(key: string, value: string) => Promise<undefined>>(async () => undefined)
    return {
      put,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://db.test',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        NEXT_PUBLIC_SITE_URL: 'https://x.test',
        CF_VERSION_METADATA: { id: 'v1' },
        BACKUPS: { get: async () => (stored ? { json: async () => stored } : null), put },
      },
    }
  }
  const good = async (url: string) =>
    url.includes('/rest/v1/')
      ? Response.json([{ slug: 'a' }])
      : url.includes('/_next/static/')
        ? file(url.endsWith('.css') ? 'text/css' : 'text/javascript')
        : page()

  it('records a pass', async () => {
    const { env: e, put } = env(null)
    await runPostDeployCheck(e, good as never)
    expect(JSON.parse(put.mock.calls[0][1])).toMatchObject({ version: 'v1', ok: true, attempts: 1 })
  })
  it('does nothing for a version that already passed', async () => {
    const { env: e, put } = env(record({ ok: true }))
    const fetchFn = vi.fn()
    await runPostDeployCheck(e, fetchFn as never)
    expect(fetchFn).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })
  it('records a failure with its attempt count and logs it as an error', async () => {
    const { env: e, put } = env(record({ ok: false, attempts: 1 }))
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await runPostDeployCheck(e, (async (url: string) => (url.includes('/rest/v1/') ? Response.json([{ slug: 'a' }]) : new Response('', { status: 503 }))) as never)
    expect(JSON.parse(put.mock.calls[0][1])).toMatchObject({ ok: false, attempts: 2 })
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
  it('never throws when the sample cannot be read', async () => {
    const { env: e } = env(null)
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(runPostDeployCheck(e, (async () => new Response('', { status: 500 })) as never)).resolves.toBeUndefined()
    err.mockRestore()
  })
})
