import { STAFF_RESOURCES, type StaffResource } from '../registry'
import type { StaffPermission } from '../permissions'
import { UUID_RE } from '../users'
import type { ReadTool, ToolArg, WriteTool } from './types'

/** A tool as the endpoint serves it, derived from one registry entry. */
export interface McpTool {
  /** `<resource>_list`, `<resource>_get` or `<resource>_<operation>`. */
  name: string
  description: string
  resource: string
  /** The audit `operation`: `list`, `get` or the operation name. */
  operation: string
  kind: 'list' | 'get' | 'write'
  permission: StaffPermission
  destructive: boolean
  spec: ReadTool | WriteTool
  inputSchema: Record<string, unknown>
}

const TYPE_SCHEMA: Record<ToolArg['type'], Record<string, unknown>> = {
  string: { type: 'string' },
  integer: { type: 'integer' },
  boolean: { type: 'boolean' },
  uuid: { type: 'string', format: 'uuid' },
  timestamp: { type: 'string', format: 'date-time' },
  integer_list: { type: 'array', items: { type: 'integer' }, uniqueItems: true },
  string_list: { type: 'array', items: { type: 'string' }, uniqueItems: true },
}

function argSchema(a: ToolArg): Record<string, unknown> {
  const schema: Record<string, unknown> = { ...TYPE_SCHEMA[a.type], description: a.description }
  const bounds: Record<string, unknown> = {}
  if (a.min !== undefined) bounds.minimum = a.min
  if (a.max !== undefined) bounds.maximum = a.max
  if (a.maxLength !== undefined) bounds.maxLength = a.maxLength
  if (a.values) bounds.enum = [...a.values]
  // On a list the bounds describe its elements (under `items`); its own length uses minItems/maxItems.
  if (a.type === 'integer_list' || a.type === 'string_list') schema.items = { ...(schema.items as object), ...bounds }
  else Object.assign(schema, bounds)
  if (a.minItems !== undefined) schema.minItems = a.minItems
  if (a.maxItems !== undefined) schema.maxItems = a.maxItems
  return schema
}

function inputSchema(args: readonly ToolArg[], extra: Record<string, Record<string, unknown>> = {}) {
  return {
    type: 'object',
    properties: { ...Object.fromEntries(args.map((a) => [a.name, argSchema(a)])), ...extra },
    required: args.filter((a) => a.required).map((a) => a.name),
    additionalProperties: false,
  }
}

const DRY_RUN = {
  dry_run: {
    type: 'boolean',
    description: 'true: check the arguments and your permission, show the record this would act on, change nothing. The database rules (e.g. "last admin") are only checked on a real run.',
  },
}

/** Every tool the registry describes, whoever may call it. */
export function buildTools(resources: readonly StaffResource[] = STAFF_RESOURCES): McpTool[] {
  const tools: McpTool[] = []
  for (const r of resources) {
    if (r.mcp?.list) {
      tools.push({
        name: `${r.name}_list`, description: r.mcp.list.description, resource: r.name, operation: 'list', kind: 'list',
        permission: r.permission, destructive: false, spec: r.mcp.list, inputSchema: inputSchema(r.mcp.list.args),
      })
    }
    if (r.mcp?.get) {
      tools.push({
        name: `${r.name}_get`, description: r.mcp.get.description, resource: r.name, operation: 'get', kind: 'get',
        permission: r.permission, destructive: false, spec: r.mcp.get, inputSchema: inputSchema(r.mcp.get.args),
      })
    }
    for (const op of r.operations) {
      if (!op.mcp) continue
      const extra: Record<string, Record<string, unknown>> = { ...DRY_RUN }
      if (op.destructive) {
        extra.confirm = {
          type: 'string', enum: [op.name],
          description: `Required. Destructive: pass exactly "${op.name}" to confirm (or use dry_run first).`,
        }
      }
      tools.push({
        name: `${r.name}_${op.name}`,
        description: `${op.destructive ? '[destructive] ' : ''}${op.mcp.description}`,
        resource: r.name, operation: op.name, kind: 'write', permission: op.permission, destructive: op.destructive,
        spec: op.mcp, inputSchema: inputSchema(op.mcp.args, extra),
      })
    }
  }
  return tools
}

/** The tools `permissions` may call: what `tools/list` shows. */
export function toolsFor(tools: readonly McpTool[], permissions: ReadonlySet<string>): McpTool[] {
  return tools.filter((t) => permissions.has(t.permission))
}

export type ParsedArgs =
  | { ok: true; params: Record<string, unknown>; byName: Record<string, unknown>; dryRun: boolean; confirm: string | null }
  | { ok: false; message: string }

const ISO_RE = /^\d{4}-\d{2}-\d{2}([Tt ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?)?$/

function checkList(a: ToolArg, v: unknown, item: ToolArg['type']): string | null {
  if (!Array.isArray(v)) return 'must be a list'
  if (a.minItems !== undefined && v.length < a.minItems) return `must have at least ${a.minItems} items`
  if (a.maxItems !== undefined && v.length > a.maxItems) return `must have at most ${a.maxItems} items`
  if (new Set(v).size !== v.length) return 'must not repeat an item'
  for (const one of v) {
    const issue = checkValue({ ...a, type: item }, one)
    if (issue) return `has an item that ${issue}`
  }
  return null
}

function checkValue(a: ToolArg, v: unknown): string | null {
  switch (a.type) {
    case 'boolean':
      return typeof v === 'boolean' ? null : 'must be true or false'
    case 'integer':
      if (typeof v !== 'number' || !Number.isSafeInteger(v)) return 'must be an integer'
      if (a.min !== undefined && v < a.min) return `must be at least ${a.min}`
      if (a.max !== undefined && v > a.max) return `must be at most ${a.max}`
      return null
    case 'integer_list':
      return checkList(a, v, 'integer')
    case 'string_list':
      return checkList(a, v, 'string')
    case 'uuid':
      return typeof v === 'string' && UUID_RE.test(v) ? null : 'must be a uuid'
    case 'timestamp':
      return typeof v === 'string' && ISO_RE.test(v) && !Number.isNaN(Date.parse(v)) ? null : 'must be an ISO 8601 date-time'
    case 'string':
      if (typeof v !== 'string') return 'must be a string'
      if (a.maxLength !== undefined && v.length > a.maxLength) return `must be at most ${a.maxLength} characters`
      if (a.values && !a.values.includes(v)) return `must be one of: ${a.values.join(', ')}`
      return null
  }
}

/**
 * Checks `raw` against the tool's declared arguments: no unknown keys, required
 * ones present, each of the declared type and bounds. Returns the SQL parameters
 * (keyed by `param`) so nothing the client sent reaches a function by any other name.
 */
export function parseArgs(tool: McpTool, raw: unknown): ParsedArgs {
  if (raw !== undefined && (typeof raw !== 'object' || raw === null || Array.isArray(raw))) {
    return { ok: false, message: 'arguments must be an object' }
  }
  const input = (raw ?? {}) as Record<string, unknown>
  const declared = new Map(tool.spec.args.map((a) => [a.name, a]))
  const control = tool.kind === 'write' ? (['dry_run', ...(tool.destructive ? ['confirm'] : [])] as string[]) : []

  const problems: string[] = []
  for (const key of Object.keys(input)) {
    if (!declared.has(key) && !control.includes(key)) problems.push(`unknown argument "${key}"`)
  }

  const params: Record<string, unknown> = {}
  const byName: Record<string, unknown> = {}
  for (const a of declared.values()) {
    const v = input[a.name]
    if (v === undefined || v === null) {
      if (a.required) problems.push(`"${a.name}" is required`)
      continue
    }
    const issue = checkValue(a, v)
    if (issue) problems.push(`"${a.name}" ${issue}`)
    else {
      params[a.param] = v
      byName[a.name] = v
    }
  }

  const dryRun = input.dry_run
  if (dryRun !== undefined && typeof dryRun !== 'boolean') problems.push('"dry_run" must be true or false')
  const confirm = input.confirm
  if (confirm !== undefined && typeof confirm !== 'string') problems.push('"confirm" must be a string')

  if (problems.length > 0) return { ok: false, message: `Invalid arguments: ${problems.join('; ')}.` }
  return { ok: true, params, byName, dryRun: dryRun === true, confirm: typeof confirm === 'string' ? confirm : null }
}
