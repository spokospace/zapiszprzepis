import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

const SERVICE_KEY = 'service-key-for-tests'
const ACTOR = '11111111-1111-4111-8111-111111111111'

async function load() {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY)
  return (await import('./service')).mcpService
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const reply = (body: unknown, status = 200) => new Response(body === undefined ? '' : JSON.stringify(body), { status })

describe('mcp service rpc', () => {
  it('posts the arguments to the function with the service key, uncached', async () => {
    const service = await load()
    fetchMock.mockResolvedValue(reply([{ ok: 1 }]))
    const out = await service.rpc('admin_list_users_as', { p_actor: ACTOR })
    expect(out).toEqual({ ok: true, data: [{ ok: 1 }] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/admin_list_users_as')
    expect(init.method).toBe('POST')
    expect(init.cache).toBe('no-store')
    expect(init.headers).toMatchObject({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` })
    expect(JSON.parse(init.body)).toEqual({ p_actor: ACTOR })
  })

  it('treats an empty body (a void function) as success', async () => {
    const service = await load()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    expect(await service.rpc('admin_block_user_as', {})).toEqual({ ok: true, data: null })
  })

  it('reduces a database error to one of our codes and never returns its text', async () => {
    const service = await load()
    fetchMock.mockResolvedValue(reply({ code: '42501', message: 'last_admin' }, 403))
    expect(await service.rpc('admin_set_role_as', {})).toEqual({ ok: false, code: 'last_admin' })
    fetchMock.mockResolvedValue(reply({ message: 'relation "auth.users" exploded at secret' }, 400))
    expect(await service.rpc('admin_set_role_as', {})).toEqual({ ok: false, code: 'unknown' })
  })

  it('reports an unreachable database as unknown', async () => {
    const service = await load()
    fetchMock.mockRejectedValue(new Error('network'))
    expect(await service.rpc('x', {})).toEqual({ ok: false, code: 'unknown' })
  })
})

describe('mcp service resolveToken', () => {
  it('returns the actor and permissions of a live token', async () => {
    const service = await load()
    fetchMock.mockResolvedValue(reply([{ token_id: '7', actor_id: ACTOR, permissions: ['users.read', 'tokens.own'] }]))
    const out = await service.resolveToken('abc')
    expect(out).toEqual({ tokenId: 7, actorId: ACTOR, permissions: new Set(['users.read', 'tokens.own']) })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ p_hash: 'abc' })
  })

  it('returns null when no row matches', async () => {
    const service = await load()
    fetchMock.mockResolvedValue(reply([]))
    expect(await service.resolveToken('abc')).toBeNull()
  })

  it('throws (so the endpoint answers 503, not 401) when the database fails or answers nonsense', async () => {
    const service = await load()
    fetchMock.mockResolvedValue(reply({ message: 'boom' }, 500))
    await expect(service.resolveToken('abc')).rejects.toThrow()
    fetchMock.mockResolvedValue(reply([{ token_id: 'x', actor_id: 'nope', permissions: [] }]))
    await expect(service.resolveToken('abc')).rejects.toThrow()
  })
})
