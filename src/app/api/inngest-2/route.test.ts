import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const handlers = vi.hoisted(() => ({
  GET: vi.fn(async () => new Response('served', { status: 200 })),
  POST: vi.fn(async () => new Response('served', { status: 200 })),
  PUT: vi.fn(async () => new Response('served', { status: 200 })),
}))
const getSecondary = vi.hoisted(() => vi.fn())
const serve = vi.hoisted(() => vi.fn(() => handlers))

vi.mock('@/inngest/client', () => ({ getInngestSecondary: getSecondary }))
vi.mock('@/inngest/functions', () => ({ extractRecipe: {} }))
vi.mock('inngest/next', () => ({ serve }))

import { GET, POST, PUT } from './route'

const req = {} as any
const ctx = {}

describe('/api/inngest-2 — secondary Inngest serve endpoint (#580)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('INNGEST_SIGNING_KEY_2', '')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('answers 404 for every method when the secondary client is not configured', async () => {
    getSecondary.mockReturnValue(null)

    for (const handler of [GET, POST, PUT]) {
      const response = await handler(req, ctx)
      expect(response.status).toBe(404)
    }
    expect(serve).not.toHaveBeenCalled()
  })

  it('answers 404 when the secondary client exists but its signing key is missing', async () => {
    getSecondary.mockReturnValue({})

    const response = await GET(req, ctx)

    expect(response.status).toBe(404)
    expect(serve).not.toHaveBeenCalled()
  })

  it('serves the request through the secondary client once both secrets are set', async () => {
    const client = {}
    getSecondary.mockReturnValue(client)
    vi.stubEnv('INNGEST_SIGNING_KEY_2', 'signkey-test-value')

    const response = await POST(req, ctx)

    expect(serve).toHaveBeenCalledWith({ client, functions: [expect.anything()] })
    expect(handlers.POST).toHaveBeenCalledWith(req, ctx)
    expect(response.status).toBe(200)
  })
})
