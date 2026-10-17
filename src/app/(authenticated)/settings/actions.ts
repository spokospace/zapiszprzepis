'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { validateDisplayName } from '@/lib/display-name'
import { validateFirstName } from '@/lib/first-name'
import { AVATAR_BUCKET, avatarObjectPath, isAvatarColorIndex, validateAvatarUpload } from '@/lib/avatar'

export type SettingsField = 'displayName' | 'firstName' | 'avatar'

export type SettingsFormState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  /** The input to mark aria-invalid and focus. */
  field?: SettingsField
}

const SAVE_FAILED = 'Nie udało się zapisać. Spróbuj ponownie.'

function fail(message: string, field?: SettingsField): SettingsFormState {
  return { status: 'error', message, field }
}

/**
 * Save screen 2a (E01-S13): display name, private first name, avatar color and
 * photo. Everything is validated before the first write; the photo is uploaded
 * with the user's own session (Storage RLS: own folder only) and removed again
 * when the profile update fails, so a failed save leaves nothing behind.
 */
export async function saveProfileSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const displayName = validateDisplayName(formData.get('displayName'))
  if (!displayName.ok) return fail(displayName.error, 'displayName')

  const firstName = validateFirstName(formData.get('firstName'))
  if (!firstName.ok) return fail(firstName.error, 'firstName')

  const rawColor = formData.get('avatarColor')
  const color = rawColor === null || rawColor === '' ? null : Number(rawColor)
  if (color !== null && !isAvatarColorIndex(color)) return fail(SAVE_FAILED)

  const removeAvatar = formData.get('removeAvatar') === '1'
  const file = formData.get('avatar')
  const photo = file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null
  if (photo) {
    const check = validateAvatarUpload(photo)
    if (!check.ok) return fail(check.error, 'avatar')
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('Zaloguj się, aby zapisać zmiany.')

  // The old path is only needed when the picture changes (name-only saves skip the read).
  let previousPath: string | null = null
  if (photo || removeAvatar) {
    const { data: current, error: readError } = await supabase
      .from('profiles')
      .select('avatar_path')
      .eq('id', user.id)
      .maybeSingle<{ avatar_path: string | null }>()
    if (readError) return fail(SAVE_FAILED)
    previousPath = current?.avatar_path ?? null
  }

  // First name first: it is the cheapest write and touches nothing else.
  const { data: nameResult, error: nameError } = await supabase.rpc('set_first_name', {
    p_first_name: firstName.value,
  })
  if (nameError) return fail(SAVE_FAILED)
  if (nameResult === 'invalid') return fail('Tego imienia nie da się zapisać.', 'firstName')

  // "Usuń zdjęcie": the bucket is public, so the object must really be gone
  // before the screen says so — delete it first and fail the save if that
  // fails (avatar_path is then left as it was). A missing object is not an
  // error, so a retry after a failed profile update still goes through.
  const removingOnly = removeAvatar && !photo
  if (removingOnly && previousPath) {
    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([previousPath])
    if (removeError) return fail('Nie udało się usunąć zdjęcia. Spróbuj ponownie.', 'avatar')
  }

  let uploadedPath: string | null = null
  if (photo) {
    uploadedPath = avatarObjectPath(user.id)
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(uploadedPath, photo, { contentType: 'image/jpeg', upsert: false })
    if (uploadError) return fail('Nie udało się wysłać zdjęcia. Spróbuj ponownie.', 'avatar')
  }

  const update: { display_name: string; avatar_color?: number; avatar_path?: string | null } = {
    display_name: displayName.value,
  }
  if (color !== null) update.avatar_color = color
  const pictureChanged = Boolean(uploadedPath) || removeAvatar
  if (pictureChanged) update.avatar_path = uploadedPath

  const { error: updateError } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (updateError) {
    if (uploadedPath) await supabase.storage.from(AVATAR_BUCKET).remove([uploadedPath])
    return fail(SAVE_FAILED)
  }

  // A replaced picture is no longer referenced. Best effort: the orphan keeps a
  // timestamped name in a bucket nobody can list, so it is not discoverable.
  if (photo && previousPath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath])
  }

  revalidatePath('/settings')
  revalidatePath('/') // the greeting uses the first name
  return { status: 'success', message: 'Zapisano.' }
}
