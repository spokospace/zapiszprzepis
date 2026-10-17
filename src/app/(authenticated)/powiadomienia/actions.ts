'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import { NOTIFICATIONS_PATH, recipePath } from '@/lib/routes'

/**
 * "Otwórz przepis" on a Gotowe card (E01-S15): mark the share read — it moves
 * from "Nowe" to "Wcześniej" and stops counting on the bell — then open the
 * recipe. A form post, so it works without JS. RLS scopes the update to the
 * user's own share; `read_at is null` keeps the first-opened time. The slug
 * comes from public_recipes (the recipe may be someone else's, in Ulubione);
 * a recipe that is gone sends the user back to the list.
 */
export async function openReadyShare(formData: FormData): Promise<void> {
  const shareId = Number(formData.get('shareId'))
  if (!Number.isInteger(shareId) || shareId <= 0) redirect(NOTIFICATIONS_PATH)

  const { supabase, user } = await requireUser()

  const [{ data: share }, { error }] = await Promise.all([
    supabase
      .from('recipe_shares')
      .select('recipe_id')
      .eq('id', shareId)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .maybeSingle(),
    supabase
      .from('recipe_shares')
      .update({ read_at: new Date().toISOString() })
      .eq('id', shareId)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .is('read_at', null),
  ])
  if (error) console.error('[notifications] Failed to mark share read:', error)

  const recipe = share?.recipe_id
    ? (await supabase.from('public_recipes').select('slug').eq('id', share.recipe_id).maybeSingle()).data
    : null

  revalidatePath('/', 'layout')
  redirect(recipe?.slug ? recipePath(recipe.slug) : NOTIFICATIONS_PATH)
}

/**
 * "Usuń przeczytane" (E01-S15): hide read ready recipes. The rows are kept
 * (cleared_at), because the S03a merge rollback restores shares from them.
 */
export async function clearReadShares(): Promise<void> {
  const { supabase, user } = await requireUser()
  const { error } = await supabase
    .from('recipe_shares')
    .update({ cleared_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .not('read_at', 'is', null)
    .is('cleared_at', null)
  if (error) console.error('[notifications] Failed to clear read shares:', error)

  revalidatePath('/', 'layout')
}
