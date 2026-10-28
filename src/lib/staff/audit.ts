import type { SupabaseClient } from '@supabase/supabase-js'
import { STAFF_RESOURCES } from './registry'
import { UUID_RE } from './users'

/**
 * Keys that never belong in an audit payload. staff_audit() (SQL) refuses them
 * at the top level; the screen drops them at any depth as a second line, so a
 * row written by some future path cannot put an address on the page.
 */
export const FORBIDDEN_AUDIT_KEYS: ReadonlySet<string> = new Set(['email', 'phone', 'name', 'display_name', 'token', 'code'])

/** `value` without any forbidden key, however deep. Primitives and arrays pass through. */
export function sanitizePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizePayload)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !FORBIDDEN_AUDIT_KEYS.has(key.toLowerCase()))
        .map(([key, v]) => [key, sanitizePayload(v)]),
    )
  }
  return value
}

/** A payload as short readable text: `key: value` pairs, nested values as JSON. */
export function describePayload(value: unknown): string {
  const clean = sanitizePayload(value)
  if (clean === null || clean === undefined) return '—'
  if (typeof clean !== 'object' || Array.isArray(clean)) return JSON.stringify(clean)
  const entries = Object.entries(clean as Record<string, unknown>)
  if (entries.length === 0) return '—'
  return entries.map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ')
}

export interface AuditEntry {
  id: number
  actorId: string
  via: 'panel' | 'mcp'
  resource: string
  operation: string
  targetId: string | null
  before: unknown
  after: unknown
  createdAt: string
}

export function mapAuditRow(raw: unknown): AuditEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = Number(r.id)
  if (
    !Number.isInteger(id) || id <= 0 || typeof r.actor_id !== 'string' || !UUID_RE.test(r.actor_id) ||
    (r.via !== 'panel' && r.via !== 'mcp') || typeof r.resource !== 'string' || typeof r.operation !== 'string' ||
    typeof r.created_at !== 'string'
  ) {
    return null
  }
  return {
    id,
    actorId: r.actor_id,
    via: r.via,
    resource: r.resource,
    operation: r.operation,
    targetId: typeof r.target_id === 'string' ? r.target_id : null,
    before: r.before ?? null,
    after: r.after ?? null,
    createdAt: r.created_at,
  }
}

/** The resources the filter offers: everything the registry knows. */
export const AUDIT_RESOURCES: readonly string[] = STAFF_RESOURCES.map((r) => r.name)

export interface AuditFilters {
  resource: string | null
  actor: string | null
  from: string | null
  to: string | null
  beforeId: number | null
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** The audit screen's query string, reduced to values the database function accepts. */
export function parseAuditFilters(params: { resource?: string; actor?: string; from?: string; to?: string; before?: string }): AuditFilters {
  const beforeId = Number(params.before)
  return {
    resource: params.resource && AUDIT_RESOURCES.includes(params.resource) ? params.resource : null,
    actor: params.actor && UUID_RE.test(params.actor) ? params.actor : null,
    from: params.from && DAY_RE.test(params.from) && !Number.isNaN(Date.parse(params.from)) ? params.from : null,
    to: params.to && DAY_RE.test(params.to) && !Number.isNaN(Date.parse(params.to)) ? params.to : null,
    beforeId: Number.isInteger(beforeId) && beforeId > 0 ? beforeId : null,
  }
}

export const AUDIT_PAGE_SIZE = 50

export interface AuditPage {
  entries: AuditEntry[]
  nextBeforeId: number | null
}

export async function listAudit(supabase: SupabaseClient, filters: AuditFilters): Promise<AuditPage | null> {
  const { data, error } = await supabase.rpc('admin_list_audit', {
    p_resource: filters.resource,
    p_filter_actor: filters.actor,
    // Whole days, UTC: from the start of `from` up to (not including) the day after `to`.
    p_from: filters.from ? `${filters.from}T00:00:00Z` : null,
    p_to: filters.to ? new Date(Date.parse(`${filters.to}T00:00:00Z`) + 86_400_000).toISOString() : null,
    p_limit: AUDIT_PAGE_SIZE + 1,
    p_before_id: filters.beforeId,
  })
  if (error || !Array.isArray(data)) {
    console.error('[staff] admin_list_audit failed:', error?.message)
    return null
  }
  const rows = data.map(mapAuditRow).filter((e): e is AuditEntry => e !== null)
  const entries = rows.slice(0, AUDIT_PAGE_SIZE)
  return {
    entries,
    nextBeforeId: rows.length > AUDIT_PAGE_SIZE && entries.length > 0 ? entries[entries.length - 1].id : null,
  }
}
