import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

const { headers } = await import('next/headers')
const { getSiteUrl } = await import('./site-url')

const mockHeaders = vi.mocked(headers)

function fakeHeaders(map: Record<string, string | null>) {
  return Promise.resolve({
    get: (key: string) => map[key.toLowerCase()] ?? null,
  }) as unknown as ReturnType<typeof headers>
}

describe('getSiteUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('returns NEXT_PUBLIC_SITE_URL when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://zapiszprzepis.pl'
    expect(await getSiteUrl()).toBe('https://zapiszprzepis.pl')
  })

  it('strips trailing slash from NEXT_PUBLIC_SITE_URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://zapiszprzepis.pl/'
    expect(await getSiteUrl()).toBe('https://zapiszprzepis.pl')
  })

  it('falls back to localhost host with http protocol', async () => {
    mockHeaders.mockReturnValue(fakeHeaders({ host: 'localhost:3000', 'x-forwarded-proto': null }))
    expect(await getSiteUrl()).toBe('http://localhost:3000')
  })

  it('detects 127.0.0.1 as local (http)', async () => {
    mockHeaders.mockReturnValue(fakeHeaders({ host: '127.0.0.1:3000', 'x-forwarded-proto': null }))
    expect(await getSiteUrl()).toBe('http://127.0.0.1:3000')
  })

  it('detects LAN IP 192.168.x.x as local (http)', async () => {
    mockHeaders.mockReturnValue(fakeHeaders({ host: '192.168.1.100:3000', 'x-forwarded-proto': null }))
    expect(await getSiteUrl()).toBe('http://192.168.1.100:3000')
  })

  it('detects *.local hostname as local (http)', async () => {
    mockHeaders.mockReturnValue(fakeHeaders({ host: 'foo.local', 'x-forwarded-proto': null }))
    expect(await getSiteUrl()).toBe('http://foo.local')
  })

  it('uses x-forwarded-proto when present', async () => {
    mockHeaders.mockReturnValue(fakeHeaders({ host: 'example.com', 'x-forwarded-proto': 'https' }))
    expect(await getSiteUrl()).toBe('https://example.com')
  })

  it('defaults non-local hosts to https', async () => {
    mockHeaders.mockReturnValue(fakeHeaders({ host: 'example.com', 'x-forwarded-proto': null }))
    expect(await getSiteUrl()).toBe('https://example.com')
  })
})
