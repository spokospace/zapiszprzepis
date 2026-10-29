'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/staff/context'
import { STAFF_ERRORS, staffErrorCode } from '@/lib/staff/errors'
import { flashPath } from '@/lib/staff/flash'
import { callAdmin } from '@/lib/staff/rpc'
import { parseTokenForm } from '@/lib/staff/tokens'

const LIST = '/admin/tokeny'

export type CreateTokenState = { token: string } | { error: string } | null

/**
 * "Utwórz token": the secret is generated in the database and returned once, to this
 * form only, in the action result. It never goes in a URL or a redirect, the list
 * shows only a prefix, and only its hash is stored.
 */
export async function createToken(_previous: CreateTokenState, formData: FormData): Promise<CreateTokenState> {
  const staff = await requirePermission('tokens.own')
  const input = parseTokenForm(formData)
  if (!input) return { error: STAFF_ERRORS.invalid_input }

  try {
    const { data, error } = await staff.supabase.rpc('admin_create_token', { p_label: input.label, p_days: input.days })
    if (error) return { error: STAFF_ERRORS[staffErrorCode(error)] }
    if (typeof data !== 'string' || data.length === 0) return { error: STAFF_ERRORS.unknown }
    revalidatePath(LIST)
    return { token: data }
  } catch (err) {
    console.error('[staff] admin_create_token threw:', err)
    return { error: STAFF_ERRORS.unknown }
  }
}

/** "Unieważnij": the token stops working at once. Only the caller's own tokens can be revoked (the function checks). */
export async function revokeToken(formData: FormData): Promise<void> {
  const staff = await requirePermission('tokens.own')
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) redirect(flashPath(LIST, { error: 'invalid_input' }))

  const error = await callAdmin(staff.supabase, 'admin_revoke_token', { p_id: id })

  revalidatePath(LIST)
  redirect(flashPath(LIST, error ? { error } : { ok: 'revoked' }))
}
