import type { SupabaseClient } from '@supabase/supabase-js'
import { UUID_RE } from './users'

export interface StaffMember {
  userId: string
  username: string | null
  displayName: string | null
  roles: string[]
  grantedAt: string | null
}

export interface StaffRole {
  name: string
  description: string | null
  permissions: string[]
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export function mapMemberRow(raw: unknown): StaffMember | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const userId = str(r.user_id)
  if (!userId || !UUID_RE.test(userId)) return null
  return {
    userId,
    username: str(r.username),
    displayName: str(r.display_name),
    roles: strings(r.roles),
    grantedAt: str(r.granted_at),
  }
}

export function mapRoleRow(raw: unknown): StaffRole | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const name = str(r.name)
  if (!name) return null
  return { name, description: str(r.description), permissions: strings(r.permissions) }
}

export async function listStaff(
  supabase: SupabaseClient,
): Promise<{ members: StaffMember[]; roles: StaffRole[] } | null> {
  const [staff, roles] = await Promise.all([supabase.rpc('admin_list_staff'), supabase.rpc('admin_list_roles')])
  if (staff.error || roles.error || !Array.isArray(staff.data) || !Array.isArray(roles.data)) {
    console.error('[staff] listing roles failed:', staff.error?.message ?? roles.error?.message)
    return null
  }
  return {
    members: staff.data.map(mapMemberRow).filter((m): m is StaffMember => m !== null),
    roles: roles.data.map(mapRoleRow).filter((r): r is StaffRole => r !== null),
  }
}

/** Role names as they are stored: lowercase letters, digits and underscore (staff_roles check). */
export const ROLE_NAME_RE = /^[a-z][a-z0-9_]{1,31}$/
