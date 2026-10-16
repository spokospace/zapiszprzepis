'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { validateDisplayName } from '@/lib/display-name'

export type DisplayNameFormState = {
  status: 'idle' | 'success' | 'error'
  message?: string
}

/** Save the signed-in user's display name. RLS scopes the update to their own row. */
export async function updateDisplayName(
  _prev: DisplayNameFormState,
  formData: FormData,
): Promise<DisplayNameFormState> {
  const result = validateDisplayName(formData.get('displayName'))
  if (!result.ok) {
    return { status: 'error', message: result.error }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { status: 'error', message: 'Zaloguj się, aby zapisać zmiany.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: result.value })
    .eq('id', user.id)
  if (error) {
    return { status: 'error', message: 'Nie udało się zapisać. Spróbuj ponownie.' }
  }

  revalidatePath('/settings')
  return { status: 'success', message: 'Zapisano.' }
}
