import type { SupabaseClient } from '@supabase/supabase-js'

export type CodeState = 'active' | 'used_up' | 'expired'

export interface StaffAccessCode {
  id: number
  note: string | null
  maxUses: number
  useCount: number
  expiresAt: string | null
  createdAt: string
  state: CodeState
}

const STATES: readonly string[] = ['active', 'used_up', 'expired']

export function mapCodeRow(raw: unknown): StaffAccessCode | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = Number(r.id)
  const maxUses = Number(r.max_uses)
  const useCount = Number(r.use_count)
  if (
    !Number.isInteger(id) || !Number.isInteger(maxUses) || !Number.isInteger(useCount) ||
    typeof r.created_at !== 'string' || typeof r.state !== 'string' || !STATES.includes(r.state)
  ) {
    return null
  }
  return {
    id,
    note: typeof r.note === 'string' ? r.note : null,
    maxUses,
    useCount,
    expiresAt: typeof r.expires_at === 'string' ? r.expires_at : null,
    createdAt: r.created_at,
    state: r.state as CodeState,
  }
}

export const CODE_STATE_LABELS: Record<CodeState, string> = {
  active: 'Aktywny',
  used_up: 'Wykorzystany',
  expired: 'Wygasł',
}

export async function listAccessCodes(supabase: SupabaseClient): Promise<StaffAccessCode[] | null> {
  const { data, error } = await supabase.rpc('admin_list_access_codes', { p_limit: 100 })
  if (error || !Array.isArray(data)) {
    console.error('[staff] admin_list_access_codes failed:', error?.message)
    return null
  }
  return data.map(mapCodeRow).filter((c): c is StaffAccessCode => c !== null)
}

export interface CodeInput {
  note: string | null
  maxUses: number
  expiresAt: string | null
}

/** The create-code form, validated. Null when it cannot be a valid code request. */
export function parseCodeForm(formData: FormData, now: Date = new Date()): CodeInput | null {
  const note = String(formData.get('note') ?? '').trim()
  if (note.length > 200) return null

  const maxUses = Number(formData.get('maxUses') ?? 1)
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) return null

  const day = String(formData.get('expires') ?? '').trim()
  let expiresAt: string | null = null
  if (day) {
    // A date input gives YYYY-MM-DD; the code works through the end of that day (UTC).
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
    const end = new Date(`${day}T23:59:59Z`)
    if (Number.isNaN(end.getTime()) || end <= now) return null
    expiresAt = end.toISOString()
  }

  return { note: note || null, maxUses, expiresAt }
}
