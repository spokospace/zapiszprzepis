'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { parseCodeForm } from '@/lib/staff/access'
import { requirePermission } from '@/lib/staff/context'
import { STAFF_ERRORS, staffErrorCode } from '@/lib/staff/errors'
import { flashPath } from '@/lib/staff/flash'
import { callAdmin } from '@/lib/staff/rpc'
import { UUID_RE } from '@/lib/staff/users'

export type CreateCodeState = { code: string } | { error: string } | null

/**
 * "Utwórz kod": the code is generated in the database and returned once, to this
 * form only, in the action result. It is never put in a URL, a redirect or the
 * audit log, and the list page shows no codes at all (only the hash is stored).
 */
export async function createAccessCode(_previous: CreateCodeState, formData: FormData): Promise<CreateCodeState> {
  const staff = await requirePermission('access.manage')
  const input = parseCodeForm(formData)
  if (!input) return { error: STAFF_ERRORS.invalid_input }

  try {
    const { data, error } = await staff.supabase.rpc('admin_create_access_code', {
      p_note: input.note,
      p_max_uses: input.maxUses,
      p_expires_at: input.expiresAt,
    })
    if (error) return { error: STAFF_ERRORS[staffErrorCode(error)] }
    if (typeof data !== 'string' || data.length === 0) return { error: STAFF_ERRORS.unknown }
    revalidatePath('/admin/dostep')
    return { code: data }
  } catch (err) {
    console.error('[staff] admin_create_access_code threw:', err)
    return { error: STAFF_ERRORS.unknown }
  }
}

/** Grant or revoke full access for one account (from the account's own screen). */
export async function setFullAccess(formData: FormData): Promise<void> {
  const staff = await requirePermission('access.manage')
  const id = String(formData.get('id') ?? '')
  const on = formData.get('on') === 'true'
  const back = `/admin/uzytkownicy/${id}`
  if (!UUID_RE.test(id)) redirect(flashPath('/admin/uzytkownicy', { error: 'invalid_input' }))

  const error = await callAdmin(staff.supabase, 'admin_set_full_access', { p_user: id, p_on: on })

  revalidatePath('/admin/uzytkownicy')
  redirect(flashPath(back, error ? { error } : { ok: on ? 'access_granted' : 'access_revoked' }))
}
