import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleMcp, MAX_BODY_BYTES } from './handler'
import { sha256Hex } from './sha256'
import { STAFF_RESOURCES, type StaffResource } from '../registry'
import { STAFF_PERMISSIONS } from '../permissions'
import { buildTools } from './tools'
import type { McpService, ResolvedToken } from './service'
import type { ServiceReply } from './types'

const send = vi.fn()
vi.mock('@/inngest/client', () => ({ inngest: { send: (...a: unknown[]) => send(...a) } }))
const revalidateRecipeCaches = vi.fn()
vi.mock('@/lib/recipe-cache', () => ({ revalidateRecipeCaches: (...a: unknown[]) => revalidateRecipeCaches(...a) }))

const ADMIN = '11111111-1111-4111-8111-111111111111'
const MOD = '22222222-2222-4222-8222-222222222222'
const PLAIN = '33333333-3333-4333-8333-333333333333'

const ADMIN_PERMS = [...STAFF_PERMISSIONS]
const MOD_PERMS = ['users.read', 'imports.read', 'imports.retry', 'recipes.read', 'tokens.own']

interface TokenRow {
  id: number
  actor: string
  revoked?: boolean
  expired?: boolean
  banned?: boolean
  roles: string[]
}

/** Stands in for staff_resolve_token: the same four reasons for "no row" as the SQL. */
function makeService(tokens: Record<string, TokenRow>, replies: Record<string, ServiceReply> = {}) {
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>): Promise<ServiceReply> => {
    void args
    return replies[fn] ?? { ok: true, data: fn === 'staff_audit' ? 1 : null }
  })
  const resolveToken = vi.fn(async (hash: string): Promise<ResolvedToken | null> => {
    const row = Object.entries(tokens).find(([raw]) => hashes.get(raw) === hash)?.[1]
    if (!row || row.revoked || row.expired || row.banned || row.roles.length === 0) return null
    return { tokenId: row.id, actorId: row.actor, permissions: new Set(row.roles.includes('admin') ? ADMIN_PERMS : MOD_PERMS) }
  })
  const withinLimit = vi.fn(async () => true)
  const service: McpService = { rpc, resolveToken, withinLimit }
  return { service, rpc, resolveToken, withinLimit }
}

const hashes = new Map<string, string>()
const raw = (n: number) => `zpm_${n.toString(16).padStart(64, '0')}`

beforeEach(async () => {
  send.mockReset()
  for (const n of [1, 2, 3, 4, 5, 6, 7]) hashes.set(raw(n), await sha256Hex(raw(n)))
})

const TOKENS: Record<string, TokenRow> = {
  [raw(1)]: { id: 1, actor: ADMIN, roles: ['admin'] },
  [raw(2)]: { id: 2, actor: MOD, roles: ['moderator'] },
  [raw(3)]: { id: 3, actor: ADMIN, roles: ['admin'], revoked: true },
  [raw(4)]: { id: 4, actor: ADMIN, roles: ['admin'], expired: true },
  [raw(5)]: { id: 5, actor: PLAIN, roles: ['admin'], banned: true },
  [raw(6)]: { id: 6, actor: PLAIN, roles: [] },
}

function post(body: unknown, token: string | null = raw(1), extra: Record<string, string> = {}) {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const call = (name: string, args?: unknown, id = 1) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })

async function result(res: Response) {
  const body = await res.json()
  expect(body.error, JSON.stringify(body.error)).toBeUndefined()
  return body.result as { content: { text: string }[]; isError: boolean }
}

const text = (r: { content: { text: string }[] }) => r.content[0].text

describe('mcp authentication', () => {
  it('refuses a request with no bearer token, before any lookup', async () => {
    const { service, resolveToken } = makeService(TOKENS)
    const res = await handleMcp(post({ jsonrpc: '2.0', id: 1, method: 'ping' }, null), service)
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toMatch(/^Bearer/)
    expect(resolveToken).not.toHaveBeenCalled()
  })

  it.each([
    ['an unknown token', raw(7)],
    ['a revoked token', raw(3)],
    ['an expired token', raw(4)],
    ['a token of a blocked account', raw(5)],
    ['a token of an account that lost its roles', raw(6)],
    ['a malformed token', 'not-a-token'],
  ])('answers 401 for %s, identically', async (_label, token) => {
    const { service, rpc } = makeService(TOKENS)
    const res = await handleMcp(post(call('users_list'), token), service)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('looks the token up by its SHA-256 hash, never the raw value', async () => {
    const { service, resolveToken } = makeService(TOKENS)
    await handleMcp(post({ jsonrpc: '2.0', id: 1, method: 'ping' }), service)
    expect(resolveToken).toHaveBeenCalledWith(hashes.get(raw(1)))
  })

  it('answers 503 when the database cannot resolve the token (not 401, not an allow)', async () => {
    const { service, resolveToken } = makeService(TOKENS)
    resolveToken.mockRejectedValueOnce(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await handleMcp(post({ jsonrpc: '2.0', id: 1, method: 'ping' }), service)
    expect(res.status).toBe(503)
  })

  it('answers 429 over the per-address cap without touching the database', async () => {
    const { service, withinLimit, resolveToken } = makeService(TOKENS)
    withinLimit.mockResolvedValueOnce(false)
    const res = await handleMcp(post({ jsonrpc: '2.0', id: 1, method: 'ping' }, raw(1), { 'cf-connecting-ip': '203.0.113.9' }), service)
    expect(res.status).toBe(429)
    expect(withinLimit).toHaveBeenCalledWith('ip:203.0.113.9')
    expect(resolveToken).not.toHaveBeenCalled()
  })

  it('answers 429 over the per-token cap, keyed by token id', async () => {
    const { service, withinLimit } = makeService(TOKENS)
    withinLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const res = await handleMcp(post({ jsonrpc: '2.0', id: 1, method: 'ping' }), service)
    expect(res.status).toBe(429)
    expect(withinLimit).toHaveBeenLastCalledWith('token:1')
    expect(res.headers.get('retry-after')).toBe('60')
  })

  it('refuses an oversized body (declared or actual) with 413', async () => {
    const { service, resolveToken } = makeService(TOKENS)
    const declared = await handleMcp(post('{}', raw(1), { 'content-length': String(MAX_BODY_BYTES + 1) }), service)
    expect(declared.status).toBe(413)
    expect(resolveToken).not.toHaveBeenCalled()
    const actual = await handleMcp(post(JSON.stringify({ pad: 'x'.repeat(MAX_BODY_BYTES) })), service)
    expect(actual.status).toBe(413)
  })
})

describe('mcp protocol', () => {
  it('initialize negotiates a known version and declares tools only', async () => {
    const { service } = makeService(TOKENS)
    const r = await result(await handleMcp(post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }), service))
    expect(r).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: {} } })
  })

  it('answers a notification with 202 and no body', async () => {
    const { service } = makeService(TOKENS)
    const res = await handleMcp(post({ jsonrpc: '2.0', method: 'notifications/initialized' }), service)
    expect(res.status).toBe(202)
    expect(await res.text()).toBe('')
  })

  it('reports bad JSON, a batch and an unknown method as JSON-RPC errors', async () => {
    const { service } = makeService(TOKENS)
    expect((await (await handleMcp(post('{nope'), service)).json()).error.code).toBe(-32700)
    expect((await (await handleMcp(post([{ jsonrpc: '2.0', id: 1, method: 'ping' }]), service)).json()).error.code).toBe(-32600)
    expect((await (await handleMcp(post({ jsonrpc: '2.0', id: 1, method: 'resources/list' }), service)).json()).error.code).toBe(-32601)
  })
})

describe('mcp tools/list', () => {
  const names = async (token: string) => {
    const { service } = makeService(TOKENS)
    const body = await (await handleMcp(post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, token), service)).json()
    return (body.result.tools as { name: string }[]).map((t) => t.name)
  }

  it('shows a moderator only users (read), imports, recipes (read) and nothing administrative', async () => {
    expect(await names(raw(2))).toEqual(['users_list', 'users_get', 'imports_list', 'imports_retry', 'recipes_list', 'recipes_get'])
  })

  it('shows an admin every tool, named <resource>_<verb>', async () => {
    expect(await names(raw(1))).toEqual(expect.arrayContaining([
      'users_list', 'users_get', 'users_block', 'users_unblock', 'users_delete',
      'imports_list', 'imports_retry', 'access_list', 'access_create_code', 'access_set_full_access',
      'roles_list', 'roles_set_role', 'audit_list',
    ]))
  })

  it('offers dry_run on every change and confirm only on destructive ones', async () => {
    const tools = buildTools()
    const byName = Object.fromEntries(tools.map((t) => [t.name, t.inputSchema.properties as Record<string, unknown>]))
    expect(byName.users_block).toHaveProperty('dry_run')
    expect(byName.users_block).toHaveProperty('confirm')
    expect(byName.users_unblock).not.toHaveProperty('confirm')
    expect(byName.users_list).not.toHaveProperty('dry_run')
  })
})

describe('mcp tools/call: permissions', () => {
  it('refuses a moderator forcing an admin-only tool, and audits the attempt as denied', async () => {
    const { service, rpc } = makeService(TOKENS)
    const r = await result(await handleMcp(post(call('users_block', { user_id: PLAIN, confirm: 'block' }), raw(2)), service))
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/Permission denied.*users\.block/)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('staff_audit', expect.objectContaining({
      p_actor: MOD, p_via: 'mcp', p_token_id: 2, p_resource: 'users', p_operation: 'block', p_after: { outcome: 'denied' },
    }))
  })

  it('refuses a moderator reading the audit log', async () => {
    const { service, rpc } = makeService(TOKENS)
    const r = await result(await handleMcp(post(call('audit_list'), raw(2)), service))
    expect(r.isError).toBe(true)
    expect(rpc).not.toHaveBeenCalledWith('admin_list_audit_as', expect.anything())
  })

  it('reports an unknown tool without calling the database', async () => {
    const { service, rpc } = makeService(TOKENS)
    const r = await result(await handleMcp(post(call('users_nuke')), service))
    expect(r).toMatchObject({ isError: true })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('shows a SQL refusal as an error and records it as denied (roles changed since the token was resolved)', async () => {
    const { service, rpc } = makeService(TOKENS, { admin_unblock_user_as: { ok: false, code: 'forbidden' } })
    const r = await result(await handleMcp(post(call('users_unblock', { user_id: PLAIN })), service))
    expect(r).toMatchObject({ isError: true })
    expect(text(r)).toBe('Permission denied.')
    expect(rpc).toHaveBeenLastCalledWith('staff_audit', expect.objectContaining({ p_after: { outcome: 'denied' } }))
  })
})

describe('mcp tools/call: arguments', () => {
  it('rejects unknown keys, a bad uuid and a missing required argument, naming each', async () => {
    const { service, rpc } = makeService(TOKENS)
    const r = await result(await handleMcp(post(call('users_get', { user_id: 'nope', extra: 1 })), service))
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/unknown argument "extra"/)
    expect(text(r)).toMatch(/"user_id" must be a uuid/)
    const missing = await result(await handleMcp(post(call('users_get', {})), service))
    expect(text(missing)).toMatch(/"user_id" is required/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('bounds numbers and enums', async () => {
    const { service } = makeService(TOKENS)
    expect(text(await result(await handleMcp(post(call('users_list', { limit: 500 })), service)))).toMatch(/at most 50/)
    expect(text(await result(await handleMcp(post(call('imports_list', { status: 'everything' })), service)))).toMatch(/one of/)
  })

  it('maps tool argument names to SQL parameters and nothing else', async () => {
    const { service, rpc } = makeService(TOKENS)
    await handleMcp(post(call('users_list', { query: 'ala', limit: 5 })), service)
    expect(rpc).toHaveBeenNthCalledWith(1, 'admin_list_users_as', { p_actor: ADMIN, p_query: 'ala', p_limit: 5 })
  })
})

describe('mcp tools/call: reads', () => {
  it('returns the rows and audits the read with via mcp and the token id', async () => {
    const { service, rpc } = makeService(TOKENS, { admin_list_imports_as: { ok: true, data: [{ share_id: 1 }] } })
    const r = await result(await handleMcp(post(call('imports_list', { status: 'failed' }), raw(2)), service))
    expect(r.isError).toBe(false)
    expect(JSON.parse(text(r))).toEqual([{ share_id: 1 }])
    expect(rpc).toHaveBeenCalledWith('staff_audit', expect.objectContaining({ p_actor: MOD, p_via: 'mcp', p_token_id: 2, p_operation: 'list', p_after: { outcome: 'read' } }))
  })

  it('does not serve a read it could not record', async () => {
    const { service } = makeService(TOKENS, { admin_list_imports_as: { ok: true, data: [{ share_id: 1 }] }, staff_audit: { ok: false, code: 'unknown' } })
    const r = await result(await handleMcp(post(call('imports_list')), service))
    expect(r.isError).toBe(true)
    expect(text(r)).not.toContain('share_id')
  })

  it('answers not found for an empty get', async () => {
    const { service } = makeService(TOKENS, { admin_get_user_as: { ok: true, data: [] } })
    const r = await result(await handleMcp(post(call('users_get', { user_id: PLAIN })), service))
    expect(r).toMatchObject({ isError: true })
    expect(text(r)).toBe('Not found.')
  })

  it('cuts a very long result', async () => {
    const { service } = makeService(TOKENS, { admin_list_audit_as: { ok: true, data: ['x'.repeat(70_000)] } })
    const r = await result(await handleMcp(post(call('audit_list')), service))
    expect(text(r)).toMatch(/truncated/)
  })
})

describe('mcp tools/call: confirm and dry_run', () => {
  it('will not run a destructive tool without confirm, and runs nothing', async () => {
    const { service, rpc } = makeService(TOKENS)
    for (const args of [{ user_id: PLAIN }, { user_id: PLAIN, confirm: 'yes' }, { user_id: PLAIN, confirm: 'users_delete' }]) {
      const r = await result(await handleMcp(post(call('users_delete', args)), service))
      expect(r.isError).toBe(true)
      expect(text(r)).toMatch(/confirm: "delete"/)
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('runs it with the exact confirmation, as the actor, marked mcp, with the token id', async () => {
    const { service, rpc } = makeService(TOKENS)
    const r = await result(await handleMcp(post(call('users_delete', { user_id: PLAIN, confirm: 'delete' })), service))
    expect(r.isError).toBe(false)
    expect(rpc).toHaveBeenCalledWith('admin_delete_user_as', { p_actor: ADMIN, p_user: PLAIN, p_via: 'mcp', p_token_id: 1 })
  })

  it('does not require confirm for a non-destructive tool', async () => {
    const { service, rpc } = makeService(TOKENS)
    const r = await result(await handleMcp(post(call('users_unblock', { user_id: PLAIN })), service))
    expect(r.isError).toBe(false)
    expect(rpc).toHaveBeenCalledWith('admin_unblock_user_as', { p_actor: ADMIN, p_user: PLAIN, p_via: 'mcp', p_token_id: 1 })
  })

  it('dry_run shows the current record, writes nothing, needs no confirm, and is audited as a preview', async () => {
    const { service, rpc } = makeService(TOKENS, { admin_get_user_as: { ok: true, data: [{ user_id: PLAIN, blocked: false }] } })
    const r = await result(await handleMcp(post(call('users_delete', { user_id: PLAIN, dry_run: true })), service))
    expect(r.isError).toBe(false)
    expect(JSON.parse(text(r))).toMatchObject({ dry_run: true, changed: false, current: { user_id: PLAIN, blocked: false } })
    const fns = rpc.mock.calls.map((c) => c[0])
    expect(fns).toEqual(['admin_get_user_as', 'staff_audit'])
    expect(rpc).toHaveBeenLastCalledWith('staff_audit', expect.objectContaining({ p_operation: 'delete', p_after: { outcome: 'dry_run' } }))
  })

  it('dry_run still needs the permission', async () => {
    const { service, rpc } = makeService(TOKENS)
    const r = await result(await handleMcp(post(call('users_delete', { user_id: PLAIN, dry_run: true }), raw(2)), service))
    expect(r.isError).toBe(true)
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['staff_audit'])
  })

  it('turns SQL error codes into English text, and never shows database free text', async () => {
    const { service } = makeService(TOKENS, { admin_set_role_as: { ok: false, code: 'last_admin' } })
    const r = await result(await handleMcp(post(call('roles_set_role', { user_id: PLAIN, role: 'admin', on: false, confirm: 'set_role' })), service))
    expect(text(r)).toMatch(/last admin/)
  })
})

describe('mcp import retry', () => {
  const reply = { admin_retry_import_as: { ok: true, data: { shareId: 9, sharedUrl: 'https://example.com/p', userId: ADMIN } } } as const

  it('sends the same recipe/extract event the panel does', async () => {
    const { service } = makeService(TOKENS, { ...reply })
    send.mockResolvedValue(undefined)
    const r = await result(await handleMcp(post(call('imports_retry', { share_id: 9 }), raw(2)), service))
    expect(r.isError).toBe(false)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ name: 'recipe/extract', data: expect.objectContaining({ shareId: 9, userId: ADMIN }) }))
  })

  it('puts the share back on the failed list when the event cannot be sent', async () => {
    const { service, rpc } = makeService(TOKENS, { ...reply })
    send.mockRejectedValue(new Error('inngest down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await result(await handleMcp(post(call('imports_retry', { share_id: 9 }), raw(2)), service))
    expect(r.isError).toBe(true)
    expect(rpc).toHaveBeenCalledWith('admin_import_dispatch_failed_as', { p_actor: MOD, p_share: 9, p_via: 'mcp', p_token_id: 2 })
  })
})

describe('the endpoint holds no per-resource code', () => {
  it('serves tools for a resource that exists only as a registry entry', async () => {
    const recipes: StaffResource = {
      name: 'recipes', label: 'Przepisy', path: '/admin/przepisy', permission: 'recipes.read',
      mcp: { list: { description: 'List recipes.', rpc: 'admin_list_recipes_as', args: [] } },
      operations: [{
        name: 'hide', label: 'Ukryj', permission: 'recipes.hide', destructive: false,
        mcp: { description: 'Hide a recipe.', rpc: 'admin_hide_recipe_as', args: [{ name: 'recipe_id', param: 'p_recipe', type: 'integer', required: true, description: 'id' }] },
      }],
    }
    const { service, rpc } = makeService(TOKENS)
    const resources = [...STAFF_RESOURCES, recipes]
    const list = await (await handleMcp(post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, raw(2)), service, resources)).json()
    // A moderator holds recipes.read but not recipes.hide: the read tool appears, the change does not.
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(['recipes_list']))
    expect(list.result.tools.map((t: { name: string }) => t.name)).not.toContain('recipes_hide')
    const admin = await (await handleMcp(post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), service, resources)).json()
    expect(admin.result.tools.map((t: { name: string }) => t.name)).toContain('recipes_hide')
    await handleMcp(post(call('recipes_hide', { recipe_id: 4 })), service, resources)
    expect(rpc).toHaveBeenCalledWith('admin_hide_recipe_as', { p_actor: ADMIN, p_recipe: 4, p_via: 'mcp', p_token_id: 1 })
  })

  it('only ever calls SQL functions the registry names, plus the audit writer', async () => {
    const { service, rpc } = makeService(TOKENS)
    for (const t of buildTools()) {
      const args = Object.fromEntries(
        t.spec.args.filter((a) => a.required).map((a) => [a.name, a.type === 'uuid' ? PLAIN : a.type === 'integer' ? 1 : a.type === 'boolean' ? true : 'moderator']),
      )
      await handleMcp(post(call(t.name, t.kind === 'write' && t.destructive ? { ...args, confirm: t.operation } : args)), service)
    }
    const allowed = new Set<string>(['staff_audit'])
    for (const r of STAFF_RESOURCES) {
      for (const f of [r.mcp?.list, r.mcp?.get, ...r.operations.map((o) => o.mcp)]) if (f) allowed.add(f.rpc)
    }
    allowed.add('admin_import_dispatch_failed_as')
    for (const [fn] of rpc.mock.calls) expect(allowed.has(fn as string), fn as string).toBe(true)
    expect(rpc.mock.calls.length).toBeGreaterThan(10)
  })
})

describe('mcp tools/call: recipes', () => {
  beforeEach(() => revalidateRecipeCaches.mockReset())

  it('merges through the _as function as the token owner, then empties the caches of every page it touched', async () => {
    const merged = { merge_id: '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b', canonical_slug: 'sernik', loser_slugs: ['sernik-2'] }
    const { service, rpc } = makeService(TOKENS, { admin_merge_recipes_as: { ok: true, data: merged } })
    const r = await result(await handleMcp(post(call('recipes_merge', { canonical_id: 5, duplicate_ids: [6], confirm: 'merge' })), service))
    expect(r.isError).toBe(false)
    expect(JSON.parse(text(r))).toEqual(merged)
    expect(rpc).toHaveBeenCalledWith('admin_merge_recipes_as', {
      p_actor: ADMIN, p_canonical: 5, p_losers: [6], p_via: 'mcp', p_token_id: 1,
    })
    expect(revalidateRecipeCaches.mock.calls.map((c) => c[0])).toEqual(['sernik', 'sernik-2'])
  })

  it('asks for confirm before a merge and changes nothing without it', async () => {
    const { service, rpc } = makeService(TOKENS)
    const r = await result(await handleMcp(post(call('recipes_merge', { canonical_id: 5, duplicate_ids: [6] })), service))
    expect(r.isError).toBe(true)
    expect(rpc).not.toHaveBeenCalledWith('admin_merge_recipes_as', expect.anything())
  })

  it('previews a hide with the recipe as it is now and writes nothing', async () => {
    const row = { recipe_id: 5, slug: 'zupa', hidden_at: null }
    const { service, rpc } = makeService(TOKENS, { admin_get_recipe_as: { ok: true, data: [row] } })
    const r = await result(await handleMcp(post(call('recipes_hide', { recipe_id: 5, dry_run: true })), service))
    expect(JSON.parse(text(r))).toMatchObject({ dry_run: true, changed: false, current: row })
    expect(rpc).toHaveBeenCalledWith('admin_get_recipe_as', { p_actor: ADMIN, p_recipe: 5 })
    expect(rpc).not.toHaveBeenCalledWith('admin_hide_recipe_as', expect.anything())
    expect(revalidateRecipeCaches).not.toHaveBeenCalled()
  })

  it('refuses a moderator without recipes.hide, whatever they send', async () => {
    const { service, rpc } = makeService(TOKENS)
    const r = await result(await handleMcp(post(call('recipes_hide', { recipe_id: 5 }), raw(2)), service))
    expect(r.isError).toBe(true)
    expect(text(r)).toContain('recipes.hide')
    expect(rpc).not.toHaveBeenCalledWith('admin_hide_recipe_as', expect.anything())
  })

  it('does not empty any cache when the database refuses the change', async () => {
    const { service } = makeService(TOKENS, { admin_hide_recipe_as: { ok: false, code: 'not_found' } })
    const r = await result(await handleMcp(post(call('recipes_hide', { recipe_id: 5 })), service))
    expect(r.isError).toBe(true)
    expect(revalidateRecipeCaches).not.toHaveBeenCalled()
  })
})
