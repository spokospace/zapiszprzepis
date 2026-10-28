'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/staff/context'
import { flashPath } from '@/lib/staff/flash'
import { callAdmin } from '@/lib/staff/rpc'
import { DELETE_CONFIRMATION, UUID_RE } from '@/lib/staff/users'

const LIST = '/admin/uzytkownicy'
const detail = (id: string) => `${LIST}/${id}`

function userId(formData: FormData): string | null {
  const id = String(formData.get('id') ?? '')
  return UUID_RE.test(id) ? id : null
}

/** "Zablokuj konto": no sign-in and no token refresh; the data stays. */
export async function blockUser(formData: FormData): Promise<void> {
  const staff = await requirePermission('users.block')
  const id = userId(formData)
  if (!id) redirect(flashPath(LIST, { error: 'invalid_input' }))

  const reason = String(formData.get('reason') ?? '').trim().slice(0, 200)
  const error = await callAdmin(staff.supabase, 'admin_block_user', { p_user: id, p_reason: reason || null })

  revalidatePath(LIST)
  redirect(flashPath(detail(id), error ? { error } : { ok: 'blocked' }))
}

export async function unblockUser(formData: FormData): Promise<void> {
  const staff = await requirePermission('users.block')
  const id = userId(formData)
  if (!id) redirect(flashPath(LIST, { error: 'invalid_input' }))

  const error = await callAdmin(staff.supabase, 'admin_unblock_user', { p_user: id })

  revalidatePath(LIST)
  redirect(flashPath(detail(id), error ? { error } : { ok: 'unblocked' }))
}

/** "Usuń konto i dane": irreversible; the typed phrase is checked here before the call. */
export async function deleteUser(formData: FormData): Promise<void> {
  const staff = await requirePermission('users.delete')
  const id = userId(formData)
  if (!id) redirect(flashPath(LIST, { error: 'invalid_input' }))

  if (String(formData.get('confirm') ?? '').trim().toLocaleUpperCase('pl-PL') !== DELETE_CONFIRMATION) {
    redirect(flashPath(detail(id), { error: 'confirm_mismatch' }))
  }

  const error = await callAdmin(staff.supabase, 'admin_delete_user', { p_user: id })

  revalidatePath(LIST)
  redirect(error ? flashPath(detail(id), { error }) : flashPath(LIST, { ok: 'deleted' }))
}
