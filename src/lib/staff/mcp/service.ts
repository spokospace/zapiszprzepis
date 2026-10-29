import 'server-only'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { withinRateLimit } from '@/lib/rate-limit'
import { staffErrorCode } from '../errors'
import { UUID_RE } from '../users'
import type { ServiceReply } from './types'

export interface ResolvedToken {
  tokenId: number
  actorId: string
  /** What the owner's roles grant right now. */
  permissions: ReadonlySet<string>
}

/** Everything the endpoint needs from the outside world, so tests can stand in for it. */
export interface McpService {
  /** Calls a SQL function with the service key. Names come from the registry, never from a client. */
  rpc(fn: string, args: Record<string, unknown>): Promise<ServiceReply>
  /** Token hash -> actor, or null for an unknown, revoked or expired token, a blocked or role-less account. Throws when the database cannot answer. */
  resolveToken(hash: string): Promise<ResolvedToken | null>
  /** False once `key` is over its cap. */
  withinLimit(key: string): Promise<boolean>
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<ServiceReply> {
  const key = getSuabaseServiceRoleKey()
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    console.error(`[mcp] ${fn} unreachable:`, err)
    return { ok: false, code: 'unknown' }
  }
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // A non-JSON body is an infrastructure error page; handled as a failure below.
  }
  if (res.ok) return { ok: true, data: body }
  const message = typeof (body as { message?: unknown } | null)?.message === 'string' ? (body as { message: string }).message : undefined
  const code = staffErrorCode({ message })
  // Free text from the database is logged, never returned.
  if (code === 'unknown') console.error(`[mcp] ${fn} failed (${res.status}):`, message ?? text.slice(0, 200))
  return { ok: false, code }
}

async function resolveToken(hash: string): Promise<ResolvedToken | null> {
  const reply = await rpc('staff_resolve_token', { p_hash: hash })
  if (!reply.ok) throw new Error(`staff_resolve_token failed: ${reply.code}`)
  const row = Array.isArray(reply.data) ? (reply.data[0] as Record<string, unknown> | undefined) : undefined
  if (!row) return null
  const tokenId = Number(row.token_id)
  const actorId = row.actor_id
  if (!Number.isSafeInteger(tokenId) || typeof actorId !== 'string' || !UUID_RE.test(actorId) || !Array.isArray(row.permissions)) {
    throw new Error('staff_resolve_token returned an unexpected row')
  }
  return { tokenId, actorId, permissions: new Set(row.permissions.filter((p): p is string => typeof p === 'string')) }
}

export const mcpService: McpService = {
  rpc,
  resolveToken,
  withinLimit: (key) => withinRateLimit('MCP_LIMIT', key),
}
