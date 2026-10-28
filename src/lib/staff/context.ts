import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { requireUser } from '@/lib/supabase/server'
import { parsePermissions, type StaffPermission } from './permissions'

export interface Staff {
  supabase: SupabaseClient
  user: User
  permissions: ReadonlySet<StaffPermission>
}

/**
 * The signed-in user as staff, or null when they hold no role. Reads the
 * caller's own permissions through my_permissions() (SECURITY DEFINER, keyed on
 * auth.uid()), so the answer cannot be steered from the client. Fails CLOSED: an
 * RPC error means "not staff", and the panel answers 404 like any unknown path.
 * Shared by the layout and the page of one render through React `cache()`.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const { supabase, user } = await requireUser()
  try {
    const { data, error } = await supabase.rpc('my_permissions')
    if (error) {
      console.error('[staff] my_permissions failed:', error.message)
      return null
    }
    const permissions = parsePermissions(data)
    return permissions.size > 0 ? { supabase, user, permissions } : null
  } catch (err) {
    console.error('[staff] my_permissions threw:', err)
    return null
  }
})

/**
 * Guard for an admin page or action: the staff member holding `permission`, else a
 * 404. A layout and its page render in parallel, so every page calls this itself
 * instead of relying on the layout having run first. A 404 (not 403) keeps the
 * panel's existence to itself.
 */
export async function requirePermission(permission: StaffPermission): Promise<Staff> {
  const staff = await getStaff()
  if (!staff || !staff.permissions.has(permission)) notFound()
  return staff
}
