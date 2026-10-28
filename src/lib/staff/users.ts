import type { SupabaseClient } from '@supabase/supabase-js'

export interface StaffUser {
  id: string
  username: string | null
  displayName: string | null
  /** Null unless the caller holds users.read_email. */
  email: string | null
  createdAt: string
  lastSignInAt: string | null
  blocked: boolean
  provider: string
  recipeCount: number
  favoriteCount: number
  fullAccess: boolean
  roles: string[]
}

/** The phrase staff type to confirm deleting an account. */
export const DELETE_CONFIRMATION = 'USUŃ'

export const UUID_RE =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
// bigint counts arrive as numbers or numeric strings depending on the driver.
const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN)

/** A row from admin_user_row, or null when it does not have the expected shape. */
export function mapUserRow(raw: unknown, now: Date = new Date()): StaffUser | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = str(r.user_id)
  const createdAt = str(r.created_at)
  const recipeCount = num(r.recipe_count)
  const favoriteCount = num(r.favorite_count)
  if (!id || !UUID_RE.test(id) || !createdAt || Number.isNaN(recipeCount) || Number.isNaN(favoriteCount)) return null
  const bannedUntil = str(r.banned_until)
  return {
    id,
    username: str(r.username),
    displayName: str(r.display_name),
    email: str(r.email),
    createdAt,
    lastSignInAt: str(r.last_sign_in_at),
    blocked: bannedUntil !== null && new Date(bannedUntil) > now,
    provider: str(r.provider) ?? 'email',
    recipeCount,
    favoriteCount,
    fullAccess: r.full_access === true,
    roles: Array.isArray(r.roles) ? r.roles.filter((x): x is string => typeof x === 'string') : [],
  }
}

export const USERS_PAGE_SIZE = 25

export interface UsersCursor {
  createdAt: string
  id: string
}

export interface UsersPage {
  users: StaffUser[]
  /** Where the next page starts; null on the last page. */
  next: UsersCursor | null
}

/** Reads one page of accounts through the caller's own session (admin_list_users). */
export async function listUsers(
  supabase: SupabaseClient,
  opts: { query?: string; after?: UsersCursor | null },
): Promise<UsersPage | null> {
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_query: opts.query?.trim() || null,
    // One extra row tells whether another page exists.
    p_limit: USERS_PAGE_SIZE + 1,
    p_after_created: opts.after?.createdAt ?? null,
    p_after_id: opts.after?.id ?? null,
  })
  if (error || !Array.isArray(data)) {
    console.error('[staff] admin_list_users failed:', error?.message)
    return null
  }
  const rows = data.map((row) => mapUserRow(row)).filter((u): u is StaffUser => u !== null)
  const users = rows.slice(0, USERS_PAGE_SIZE)
  const last = users.at(-1)
  return {
    users,
    next: rows.length > USERS_PAGE_SIZE && last ? { createdAt: last.createdAt, id: last.id } : null,
  }
}

export async function getUser(supabase: SupabaseClient, id: string): Promise<StaffUser | null> {
  if (!UUID_RE.test(id)) return null
  const { data, error } = await supabase.rpc('admin_get_user', { p_user: id })
  if (error || !Array.isArray(data)) {
    console.error('[staff] admin_get_user failed:', error?.message)
    return null
  }
  return data.length > 0 ? mapUserRow(data[0]) : null
}

/** The cursor parameters of the list URL back into a cursor; anything malformed is no cursor. */
export function parseUsersCursor(after: string | undefined, afterId: string | undefined): UsersCursor | null {
  if (!after || !afterId) return null
  if (Number.isNaN(Date.parse(after))) return null
  if (!UUID_RE.test(afterId)) return null
  return { createdAt: after, id: afterId }
}
