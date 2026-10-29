import { STAFF_ERRORS, type StaffErrorCode } from '../errors'
import { STAFF_RESOURCES, type StaffResource } from '../registry'
import { buildTools, parseArgs, toolsFor, type McpTool } from './tools'
import type { McpService, ResolvedToken } from './service'
import { sha256Hex } from './sha256'
import type { WriteTool } from './types'

/**
 * `POST /api/mcp`: the MCP Streamable HTTP transport, reduced to what a tool-only
 * server needs (`initialize`, `ping`, `tools/list`, `tools/call`), as plain JSON
 * responses. There is no per-resource code here: tools, argument checks and the
 * SQL function behind each tool come from the staff registry.
 *
 * Trust model: the bearer token names an account; the account's roles are read from
 * the database on every request (nothing is cached), and every `_as` function
 * re-checks the permission in SQL, so a bug in this file can hide a tool or show an
 * error but cannot widen what an account may do.
 */

/** A request body over this is refused before it is parsed. */
export const MAX_BODY_BYTES = 16 * 1024
/** A tool result text over this is cut, so one list cannot flood the model's context. */
export const MAX_RESULT_CHARS = 60_000

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } })
}

function rpcError(id: unknown, code: number, message: string): Response {
  return json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
}

function rpcResult(id: unknown, result: unknown): Response {
  return json({ jsonrpc: '2.0', id, result })
}

const unauthorized = () =>
  json({ error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer realm="zapiszprzepis-mcp"' })

const tooManyRequests = () => json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' })

/** English texts for the model; the panel shows the Polish ones from errors.ts. */
const ENGLISH: Partial<Record<StaffErrorCode, string>> = {
  forbidden: 'Permission denied.',
  not_found: 'Not found.',
  cannot_target_self: 'This cannot be done to your own account.',
  cannot_target_staff: 'This account holds a staff role. Remove the role first (admin only).',
  last_admin: 'This is the last admin. Grant the role to someone else first.',
  cannot_change_own_role: 'You cannot change your own roles. Ask another admin.',
  unknown_role: 'No such role.',
  not_retryable: 'This import does not need a retry, or someone already retried it.',
  dispatch_failed: 'Processing could not be started. The import was put back on the failed list; retry again later.',
  invalid_input: 'Invalid input.',
  confirm_mismatch: 'Confirmation does not match. Nothing was changed.',
  unknown: 'The operation failed (internal error). Check the audit log before retrying a change.',
}

const englishError = (code: StaffErrorCode) => ENGLISH[code] ?? STAFF_ERRORS[code] ?? ENGLISH.unknown!

/** A tool result. Failures are ordinary results with isError, not protocol errors, so the model can read and react. */
function toolResult(value: unknown, isError = false) {
  let text = typeof value === 'string' ? value : JSON.stringify(value ?? { ok: true })
  if (text.length > MAX_RESULT_CHARS) {
    text = `${text.slice(0, MAX_RESULT_CHARS)}\n[truncated: result too long, narrow the query or page with the cursor arguments]`
  }
  return { content: [{ type: 'text', text }], isError }
}

const failure = (message: string) => toolResult(message, true)

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header)
  return match ? match[1] : null
}

type Json = Record<string, unknown>

export async function handleMcp(
  request: Request,
  service: McpService,
  resources: readonly StaffResource[] = STAFF_RESOURCES,
): Promise<Response> {
  // Size first: nothing is read, hashed or looked up for an oversized body.
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)

  // Per-address cap before any database work, so wrong tokens cannot be tried at speed.
  const address = request.headers.get('cf-connecting-ip') ?? 'unknown'
  if (!(await service.withinLimit(`ip:${address}`))) return tooManyRequests()

  const token = bearer(request)
  if (!token || token.length > 200) return unauthorized()

  // Constant work: a well-formed or malformed secret costs the same hash and one indexed lookup.
  let caller: ResolvedToken | null
  try {
    caller = await service.resolveToken(await sha256Hex(token))
  } catch (err) {
    console.error('[mcp] token lookup failed:', err)
    return json({ error: 'unavailable' }, 503, { 'Retry-After': '5' })
  }
  if (!caller) return unauthorized()

  if (!(await service.withinLimit(`token:${caller.tokenId}`))) return tooManyRequests()

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)

  let message: unknown
  try {
    message = JSON.parse(raw)
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return rpcError(null, -32600, 'Send one JSON-RPC message per request.')
  }
  const { id, method, params } = message as Json
  if ((message as Json).jsonrpc !== '2.0' || typeof method !== 'string') {
    return rpcError(id, -32600, 'Invalid request')
  }

  // Notifications carry no id and get no body.
  if (id === undefined) return new Response(null, { status: 202 })

  const tools = buildTools(resources)

  switch (method) {
    case 'initialize': {
      const asked = (params as Json | undefined)?.protocolVersion
      const version = SUPPORTED_VERSIONS.find((v) => v === asked) ?? SUPPORTED_VERSIONS[0]
      return rpcResult(id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'zapiszprzepis-staff', version: '1.0.0' },
        instructions:
          'Staff operations for Zapisz Przepis, under your own account and role. tools/list shows only what you may do. ' +
          'Destructive tools need confirm with the operation name; every change accepts dry_run to preview it first.',
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, {
        tools: toolsFor(tools, caller.permissions).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: t.kind !== 'write', destructiveHint: t.destructive },
        })),
      })
    case 'tools/call': {
      const p = (params ?? {}) as Json
      if (typeof p.name !== 'string') return rpcError(id, -32602, 'Invalid params: name is required')
      return rpcResult(id, await callTool(tools, caller, service, p.name, p.arguments))
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

async function callTool(
  tools: readonly McpTool[],
  caller: ResolvedToken,
  service: McpService,
  name: string,
  rawArgs: unknown,
) {
  const tool = tools.find((t) => t.name === name)
  if (!tool) return failure(`Unknown tool "${name}".`)

  const { actorId, tokenId } = caller
  const audit = (operation: string, target: string | null, outcome: string) =>
    service.rpc('staff_audit', {
      p_actor: actorId,
      p_via: 'mcp',
      p_token_id: tokenId,
      p_resource: tool.resource,
      p_operation: operation,
      p_target_id: target,
      p_before: null,
      p_after: { outcome },
    })

  // A call to a tool the caller may not use (it is absent from their tools/list, so
  // this is a forced call): refused, and the attempt is recorded.
  if (!caller.permissions.has(tool.permission)) {
    await audit(tool.operation, null, 'denied')
    return failure(`Permission denied: "${tool.name}" requires ${tool.permission}.`)
  }

  const parsed = parseArgs(tool, rawArgs)
  if (!parsed.ok) return failure(parsed.message)

  // The record this call is about, for the audit row: the first required argument that is not a flag.
  const idArg = tool.spec.args.find((a) => a.required && a.type !== 'boolean')
  const targetId = idArg ? String(parsed.byName[idArg.name]) : null

  // Reads: run, then record. A read that cannot be recorded is not served.
  if (tool.kind !== 'write') {
    const reply = await service.rpc(tool.spec.rpc, { p_actor: actorId, ...parsed.params })
    if (!reply.ok) return failure(englishError(reply.code))
    const recorded = await audit(tool.operation, tool.kind === 'get' ? targetId : null, 'read')
    if (!recorded.ok) return failure(englishError('unknown'))
    if (tool.kind === 'get') {
      const row = Array.isArray(reply.data) ? reply.data[0] : reply.data
      return row ? toolResult(row) : failure(englishError('not_found'))
    }
    return toolResult(reply.data)
  }

  // Writes.
  if (tool.destructive && !parsed.dryRun && parsed.confirm !== tool.operation) {
    return failure(
      `"${tool.name}" is destructive. Call it again with confirm: "${tool.operation}" to proceed, or with dry_run: true to preview. Nothing was changed.`,
    )
  }

  const write = tool.spec as WriteTool

  // Preview: the arguments passed validation and the caller holds the permission; show
  // the record as it is now (through the resource's own get tool) and write nothing.
  if (parsed.dryRun) {
    let current: unknown
    const getter = tools.find((t) => t.resource === tool.resource && t.kind === 'get')
    const subject = write.target ? parsed.byName[write.target] : undefined
    if (getter && subject !== undefined) {
      const reply = await service.rpc(getter.spec.rpc, { p_actor: actorId, [getter.spec.args[0].param]: subject })
      if (!reply.ok) return failure(englishError(reply.code))
      current = Array.isArray(reply.data) ? (reply.data[0] ?? null) : reply.data
    }
    const recorded = await audit(tool.operation, targetId, 'dry_run')
    if (!recorded.ok) return failure(englishError('unknown'))
    return toolResult({ dry_run: true, tool: tool.name, arguments: parsed.byName, current, changed: false })
  }

  // The change itself: the function checks the permission again, writes and audits in one transaction.
  const reply = await service.rpc(write.rpc, { p_actor: actorId, ...parsed.params, p_via: 'mcp', p_token_id: tokenId })
  if (!reply.ok) {
    // The function raised before writing (or rolled back); a refusal it could not audit is still recorded here.
    if (reply.code === 'forbidden') await audit(tool.operation, targetId, 'denied')
    return failure(englishError(reply.code))
  }
  if (write.finish) {
    const done = await write.finish({ result: reply.data, actorId, tokenId, rpc: service.rpc })
    return done.ok ? toolResult(done.data) : failure(englishError(done.code))
  }
  return toolResult(reply.data ?? { ok: true })
}
