'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkUser } from '@/lib/supabase/user-check'
import { sendRecipeExtract } from '@/inngest/send'
import { detectSourceType } from '@/lib/detect-source-type'
import { findExistingRecipeForUrl } from '@/lib/recipe-dedup'
import { favoriteExistingRecipe } from '@/lib/intake-favorite'
import { addRecipeErrorPath, recipePath } from '@/lib/routes'
import { getFullAccess } from '@/lib/full-access'
import { extractionAllowed } from '@/lib/extraction-rate-limit'
import { revalidatePath } from 'next/cache'

export async function addRecipeFromUrl(formData: FormData): Promise<void> {
  const url = String(formData.get('url') ?? '').trim()

  if (!url) redirect(addRecipeErrorPath('empty'))

  try {
    new URL(url)
  } catch {
    redirect(addRecipeErrorPath('invalid_url'))
  }

  const supabase = await createSupabaseServerClient()
  const { user, transient } = await checkUser(supabase, 'addRecipeFromUrl')

  // A session check that could not decide is a retryable failure, not a logout.
  if (!user && transient) redirect(addRecipeErrorPath('server'))
  if (!user) redirect('/login')

  const dedup = await findExistingRecipeForUrl(supabase, user.id, url)
  if (dedup.status === 'completed') redirect(`${recipePath(dedup.slug)}?duplicate=1`)
  if (dedup.status === 'pending') redirect('/recipes?duplicate=pending')
  if (dedup.status === 'other') {
    // Someone else added the link first: favorite it instead of extracting a copy.
    let favorited = true
    try {
      await favoriteExistingRecipe(supabase, user.id, dedup.recipeId, dedup.normalizedUrl)
    } catch (err) {
      console.error('Failed to add existing recipe to favorites:', err)
      favorited = false
    }
    // redirect() throws, so it stays outside the try.
    if (!favorited) redirect(addRecipeErrorPath('server'))
    revalidatePath('/ulubione')
    redirect(`${recipePath(dedup.slug)}?in_favorites=1`)
  }

  // E01-S11: a NEW extraction needs full access (RLS refuses the insert too).
  // Checked after dedup: a link someone else already added only goes to
  // favorites, which need no full access.
  if (!(await getFullAccess(supabase))) redirect(addRecipeErrorPath('no_access'))
  // E02-S11-T04: each extraction is paid, so each account is capped.
  if (!(await extractionAllowed(user.id))) redirect(addRecipeErrorPath('rate_limited'))

  const sourceType = detectSourceType(url)

  const { data: share, error: shareError } = await supabase
    .from('recipe_shares')
    .insert({
      user_id: user.id,
      shared_url: dedup.normalizedUrl,
      // sourceType is stored so the throttle watchdog can rebuild the extract
      // event without recomputing it in the Worker cron (#580 phase 3).
      share_intent: { url: dedup.normalizedUrl, title: null, text: null, sourceType },
      status: 'pending',
      attempts: 0,
    })
    .select()
    .single()

  if (shareError || !share) {
    console.error('Failed to create share record:', shareError?.message)
    redirect(addRecipeErrorPath('server'))
  }

  try {
    const account = await sendRecipeExtract({
      shareId: share.id,
      sharedUrl: dedup.normalizedUrl,
      userId: user.id,
      sourceType,
    })
    // Record which account accepted the event so the throttle watchdog (#580
    // phase 3) can find pending shares that went to the primary.
    await supabase.from('recipe_shares').update({ inngest_account: account }).eq('id', share.id)
  } catch (err) {
    console.error('Failed to trigger extraction:', err)
    await supabase
      .from('recipe_shares')
      .update({ status: 'failed', error_message: 'Failed to queue extraction' })
      .eq('id', share.id)
  }

  redirect('/recipes?shared=1')
}
