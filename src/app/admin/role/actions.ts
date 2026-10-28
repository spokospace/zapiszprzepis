'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/staff/context'
import { flashPath } from '@/lib/staff/flash'
import { ROLE_NAME_RE } from '@/lib/staff/roles'
import { callAdmin } from '@/lib/staff/rpc'
import { UUID_RE } from '@/lib/staff/users'

/**
 * Grant or revoke one role. The last-admin and own-role rules live in
 * admin_set_role (SQL); this only validates the shape and shows the outcome on
 * the page the form came from (`from` is a whitelisted path, never a free URL).
 */
export async function setRole(formData: FormData): Promise<void> {
  const staff = await requirePermission('roles.manage')
  const id = String(formData.get('id') ?? '')
  const role = String(formData.get('role') ?? '')
  const on = formData.get('on') === 'true'
  const back = formData.get('from') === 'account' ? `/admin/uzytkownicy/${id}` : '/admin/role'

  if (!UUID_RE.test(id) || !ROLE_NAME_RE.test(role)) redirect(flashPath('/admin/role', { error: 'invalid_input' }))

  const error = await callAdmin(staff.supabase, 'admin_set_role', { p_user: id, p_role: role, p_on: on })

  revalidatePath('/admin', 'layout')
  redirect(flashPath(back, error ? { error } : { ok: on ? 'role_granted' : 'role_revoked' }))
}
