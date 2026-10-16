'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'
import { detectSourceType } from '@/lib/detect-source-type'
import { findExistingRecipeForUrl } from '@/lib/recipe-dedup'
import { favoriteExistingRecipe } from '@/lib/intake-favorite'
import { revalidatePath } from 'next/cache'

export async function addRecipeFromUrl(formData: FormData): Promise<void> {
  const url = String(formData.get('url') ?? '').trim()

  if (!url) redirect('/?add_error=empty')

  try {
    new URL(url)
  } catch {
    redirect('/?add_error=invalid_url')
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const dedup = await findExistingRecipeForUrl(supabase, user.id, url)
  if (dedup.status === 'completed') redirect(`/recipes/${dedup.slug}?duplicate=1`)
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
    if (!favorited) redirect('/?add_error=server')
    revalidatePath('/ulubione')
    redirect(`/recipes/${dedup.slug}?in_favorites=1`)
  }

  const sourceType = detectSourceType(url)

  const { data: share, error: shareError } = await supabase
    .from('recipe_shares')
    .insert({
      user_id: user.id,
      shared_url: dedup.normalizedUrl,
      share_intent: { url: dedup.normalizedUrl, title: null, text: null },
      status: 'pending',
      attempts: 0,
    })
    .select()
    .single()

  if (shareError || !share) {
    console.error('Failed to create share record:', shareError?.message)
    redirect('/?add_error=server')
  }

  try {
    await inngest.send({
      name: 'recipe/extract',
      data: {
        shareId: share.id,
        sharedUrl: dedup.normalizedUrl,
        userId: user.id,
        sourceType,
      },
    })
  } catch (err) {
    console.error('Failed to trigger extraction:', err)
    await supabase
      .from('recipe_shares')
      .update({ status: 'failed', error_message: 'Failed to queue extraction' })
      .eq('id', share.id)
  }

  redirect('/recipes?shared=1')
}
