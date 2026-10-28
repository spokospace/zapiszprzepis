'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { inngest } from '@/inngest/client'
import { requirePermission } from '@/lib/staff/context'
import { staffErrorCode } from '@/lib/staff/errors'
import { flashPath } from '@/lib/staff/flash'
import { buildExtractEvent, parseRetryPayload } from '@/lib/staff/imports'
import { callAdmin } from '@/lib/staff/rpc'

const LIST = '/admin/importy'

/**
 * "Ponów import": admin_retry_import validates, resets the share to pending and
 * audits (one transaction) and returns the event payload; the event is sent from
 * here, as the owner's retry does. If the send fails the share goes back to
 * failed so it stays on the list instead of hanging in `pending`.
 */
export async function retryImport(formData: FormData): Promise<void> {
  const staff = await requirePermission('imports.retry')
  const shareId = Number(formData.get('shareId'))
  if (!Number.isInteger(shareId) || shareId <= 0) redirect(flashPath(LIST, { error: 'invalid_input' }))

  const { data, error } = await staff.supabase.rpc('admin_retry_import', { p_share: shareId })
  if (error) redirect(flashPath(LIST, { error: staffErrorCode(error) }))

  const payload = parseRetryPayload(data)
  if (!payload) redirect(flashPath(LIST, { error: 'unknown' }))

  try {
    await inngest.send(buildExtractEvent(payload))
  } catch (err) {
    console.error('[staff] Failed to re-trigger extraction:', err)
    await callAdmin(staff.supabase, 'admin_import_dispatch_failed', { p_share: payload.shareId })
    revalidatePath(LIST)
    redirect(flashPath(LIST, { error: 'dispatch_failed' }))
  }

  revalidatePath(LIST)
  redirect(flashPath(LIST, { ok: 'retried' }))
}
