import type { SupabaseClient } from '@supabase/supabase-js'

export type TokenState = 'active' | 'revoked' | 'expired'

export interface StaffToken {
  id: number
  label: string
  /** The first characters of the secret, to tell tokens apart. Not enough to use it. */
  prefix: string
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
  revokedAt: string | null
  state: TokenState
}

export const TOKEN_STATE_LABELS: Record<TokenState, string> = {
  active: 'Aktywny',
  revoked: 'Unieważniony',
  expired: 'Wygasł',
}

const STATES: readonly string[] = ['active', 'revoked', 'expired']
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

export function mapTokenRow(raw: unknown): StaffToken | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = Number(r.id)
  const label = str(r.label)
  const prefix = str(r.prefix)
  const createdAt = str(r.created_at)
  const expiresAt = str(r.expires_at)
  const state = str(r.state)
  if (!Number.isInteger(id) || !label || !prefix || !createdAt || !expiresAt || !state || !STATES.includes(state)) return null
  return { id, label, prefix, createdAt, expiresAt, lastUsedAt: str(r.last_used_at), revokedAt: str(r.revoked_at), state: state as TokenState }
}

export async function listTokens(supabase: SupabaseClient): Promise<StaffToken[] | null> {
  const { data, error } = await supabase.rpc('admin_list_tokens')
  if (error || !Array.isArray(data)) {
    console.error('[staff] admin_list_tokens failed:', error?.message)
    return null
  }
  return data.map(mapTokenRow).filter((t): t is StaffToken => t !== null)
}

export const TOKEN_LIFETIMES = [
  { days: 30, label: '30 dni' },
  { days: 90, label: '90 dni' },
  { days: 365, label: 'rok' },
] as const

export interface TokenInput {
  label: string
  days: number
}

/** The create-token form, validated. Null when it cannot be a valid request. */
export function parseTokenForm(formData: FormData): TokenInput | null {
  const label = String(formData.get('label') ?? '').trim()
  if (label.length < 1 || label.length > 80) return null
  const days = Number(formData.get('days') ?? 90)
  if (!TOKEN_LIFETIMES.some((l) => l.days === days)) return null
  return { label, days }
}

/** The command that connects Claude Code to the endpoint, with the secret filled in. */
export function connectCommand(siteUrl: string, token: string): string {
  return `claude mcp add --transport http zapiszprzepis ${siteUrl.replace(/\/$/, '')}/api/mcp --header "Authorization: Bearer ${token}"`
}
