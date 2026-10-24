import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { clearPrivateCaches } from './pwa-utils'
import { isPublicRoute } from './routes'

// Drives the real public/sw.js (#373) through a fake service-worker runtime:
// `self` collects the event listeners, `caches` is an in-memory CacheStorage
// and `fetch` is a mock. Requests are plain objects because the fetch
// Request constructor refuses `mode: 'navigate'`.

const SW_SOURCE = readFileSync(fileURLToPath(new URL('../../public/sw.js', import.meta.url)), 'utf8')
const ORIGIN = 'https://zapiszprzepis.pl'

type FakeRequest = { url: string; method: string; mode: string; headers: Headers }
type Listener = (event: unknown) => void

function request(path: string, init: { method?: string; mode?: string; headers?: Record<string, string> } = {}): FakeRequest {
  return {
    url: new URL(path, ORIGIN).href,
    method: init.method ?? 'GET',
    mode: init.mode ?? 'navigate',
    headers: new Headers(init.headers),
  }
}

function fakeCaches() {
  const store = new Map<string, Map<string, Response>>()
  const keyOf = (req: FakeRequest | string) => new URL(typeof req === 'string' ? req : req.url, ORIGIN).href
  const open = async (name: string) => {
    if (!store.has(name)) store.set(name, new Map())
    const entries = store.get(name)!
    return {
      put: async (req: FakeRequest | string, response: Response) => { entries.set(keyOf(req), response) },
    }
  }
  return {
    store,
    seed(name: string, path: string, body: string) {
      if (!store.has(name)) store.set(name, new Map())
      store.get(name)!.set(keyOf(path), new Response(body))
    },
    api: {
      open,
      keys: async () => [...store.keys()],
      delete: async (name: string) => store.delete(name),
      match: async (req: FakeRequest | string) => {
        for (const entries of store.values()) {
          const hit = entries.get(keyOf(req))
          if (hit) return hit.clone()
        }
        return undefined
      },
    },
  }
}

function loadWorker(version = 'build1') {
  const listeners: Record<string, Listener> = {}
  const caches = fakeCaches()
  const fetch = vi.fn<(req: FakeRequest) => Promise<Response>>()
  const self = {
    location: new URL(`/sw.js?v=${version}`, ORIGIN),
    addEventListener: (type: string, listener: Listener) => { listeners[type] = listener },
    skipWaiting: vi.fn(),
  }
  const clients = { claim: vi.fn() }
  const context = vm.createContext({
    self, clients, caches: caches.api, fetch, URL, Response, console: { log() {}, warn() {} },
  })
  vm.runInContext(SW_SOURCE, context)

  // Resolves once the response and any background cache writes have settled.
  async function dispatchFetch(req: FakeRequest): Promise<Response | undefined> {
    let responded: Promise<Response> | undefined
    const pending: Promise<unknown>[] = []
    listeners.fetch({
      request: req,
      respondWith: (r: Promise<Response>) => { responded = r },
      waitUntil: (p: Promise<unknown>) => { pending.push(p) },
    })
    const response = await responded
    await Promise.all(pending)
    return response
  }

  return {
    self, clients, caches, fetch, listeners, dispatchFetch,
    routeFor: (req: FakeRequest) => (context.routeFor as (r: FakeRequest) => string)(req),
  }
}

describe('sw.js routing', () => {
  const sw = loadWorker()

  it.each([
    ['POST to /api (delete-recipe form)', request('/api/recipes/delete', { method: 'POST', mode: 'cors' })],
    ['Server Action POST', request('/przepis/sernik', { method: 'POST', mode: 'cors' })],
    ['Web Share Target POST', request('/share', { method: 'POST' })],
    ['GET /api', request('/api/dev/login', { mode: 'cors' })],
    ['RSC header (client navigation)', request('/przepis/sernik', { mode: 'cors', headers: { RSC: '1' } })],
    ['_rsc param', request('/ulubione?_rsc=abc', { mode: 'cors' })],
    ['cross-origin image', request('https://wsrv.nl/cover.jpg', { mode: 'no-cors' })],
    ['/_next/image', request('/_next/image?url=x&w=640', { mode: 'no-cors' })],
    ['non-navigation GET without extension', request('/przepis/sernik', { mode: 'cors' })],
  ])('never intercepts: %s', (_label, req) => {
    expect(sw.routeFor(req)).toBe('network')
  })

  it.each(['/', '/przepis/sernik', '/przepisy/ciasta', '/szukaj', '/u/kasia', '/wyswietlanie', '/regulamin'])(
    'caches public page %s',
    (path) => { expect(sw.routeFor(request(path))).toBe('public-page') },
  )

  it.each(['/ulubione', '/powiadomienia', '/settings', '/recipes', '/dodaj', '/witaj', '/login'])(
    'keeps %s network-only',
    (path) => { expect(sw.routeFor(request(path))).toBe('private-page') },
  )

  it('serves content-hashed build files cache-first and other files network-first', () => {
    expect(sw.routeFor(request('/_next/static/chunks/app.js', { mode: 'no-cors' }))).toBe('static')
    expect(sw.routeFor(request('/icons/icon-192.png', { mode: 'no-cors' }))).toBe('file')
  })
})

describe('sw.js fetch handling', () => {
  it('does not take over a slow POST to /api, so it is never cut off', async () => {
    const sw = loadWorker()
    expect(await sw.dispatchFetch(request('/api/recipes/delete', { method: 'POST', mode: 'cors' }))).toBeUndefined()
    expect(sw.fetch).not.toHaveBeenCalled()
  })

  it('offline, a never-visited page falls back to the cached home page', async () => {
    const sw = loadWorker()
    sw.caches.seed('zapiszprzepis-pages-build1', '/', 'home page')
    sw.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const response = await sw.dispatchFetch(request('/przepis/never-visited'))
    expect(await response?.text()).toBe('home page')
  })

  it('offline with nothing cached, answers „Offline” instead of a network error', async () => {
    const sw = loadWorker()
    sw.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const response = await sw.dispatchFetch(request('/ulubione'))
    expect(response?.status).toBe(503)
    expect(await response?.text()).toBe('Offline')
  })

  it('offline, a visited public page comes back from the cache', async () => {
    const sw = loadWorker()
    sw.fetch.mockResolvedValueOnce(new Response('sernik'))
    await sw.dispatchFetch(request('/przepis/sernik'))

    sw.fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const response = await sw.dispatchFetch(request('/przepis/sernik'))
    expect(await response?.text()).toBe('sernik')
  })

  it('never caches a signed-in page', async () => {
    const sw = loadWorker()
    sw.fetch.mockResolvedValue(new Response('my favourites'))

    const response = await sw.dispatchFetch(request('/ulubione'))
    expect(await response?.text()).toBe('my favourites')
    expect(await sw.caches.api.match(request('/ulubione'))).toBeUndefined()
  })

  it('caches build files under the version from the worker URL', async () => {
    const sw = loadWorker('abc123')
    sw.fetch.mockResolvedValue(new Response('js'))

    await sw.dispatchFetch(request('/_next/static/chunks/app.js', { mode: 'no-cors' }))
    expect([...sw.caches.store.keys()]).toEqual(['zapiszprzepis-static-abc123'])
  })
})

describe('sw.js lifecycle', () => {
  it('waits instead of taking over open tabs', async () => {
    const sw = loadWorker()
    sw.listeners.install?.({ waitUntil: vi.fn() })
    sw.listeners.activate({ waitUntil: vi.fn() })
    expect(sw.self.skipWaiting).not.toHaveBeenCalled()
    expect(sw.clients.claim).not.toHaveBeenCalled()
  })

  it('deletes every other build’s caches on activate', async () => {
    const sw = loadWorker('new')
    for (const name of [
      'zapiszprzepis-precache-v2', 'zapiszprzepis-runtime', 'zapiszprzepis-api',
      'zapiszprzepis-pages-old', 'zapiszprzepis-static-old',
      'zapiszprzepis-pages-new', 'zapiszprzepis-static-new',
    ]) sw.caches.seed(name, '/', name)

    let done: Promise<unknown> = Promise.resolve()
    sw.listeners.activate({ waitUntil: (p: Promise<unknown>) => { done = p } })
    await done

    expect([...sw.caches.store.keys()].sort()).toEqual(['zapiszprzepis-pages-new', 'zapiszprzepis-static-new'])
  })
})

// sw.js is a plain script and cannot import from src/, so it keeps its own
// copies of the public routes and cache names. These tests fail when a copy drifts.
describe('sw.js stays in sync with the app', () => {
  it.each([
    '/', '/szukaj', '/wyswietlanie', '/regulamin', '/polityka-prywatnosci', '/usuwanie-danych',
    '/przepis/sernik', '/przepisy/ciasta', '/u/kasia',
    '/ulubione', '/powiadomienia', '/settings', '/recipes', '/dodaj', '/witaj', '/login', '/signup',
  ])('treats %s as public exactly when middleware does', (path) => {
    const sw = loadWorker()
    expect(sw.routeFor(request(path)) === 'public-page').toBe(isPublicRoute(path))
  })

  it('sign-out clears the pages the worker cached and keeps its build files', async () => {
    const sw = loadWorker()
    sw.fetch.mockImplementation(async () => new Response('body'))
    await sw.dispatchFetch(request('/'))
    await sw.dispatchFetch(request('/_next/static/chunks/app.js', { mode: 'no-cors' }))
    expect(sw.caches.store.size).toBe(2)

    await clearPrivateCaches(sw.caches.api as unknown as CacheStorage)
    expect([...sw.caches.store.keys()]).toEqual(['zapiszprzepis-static-build1'])
  })
})
