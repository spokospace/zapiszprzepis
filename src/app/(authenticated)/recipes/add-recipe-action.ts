'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'
import { detectSourceType } from '@/lib/detect-source-type'

export async function addRecipeFromUrl(formData: FormData): Promise<void> {
  const url = String(formData.get('url') ?? '').trim()

  if (!url) redirect('/recipes?add_error=empty')

  try {
    new URL(url)
  } catch {
    redirect('/recipes?add_error=invalid_url')
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const sourceType = detectSourceType(url)

  const { data: share, error: shareError } = await supabase
    .from('recipe_shares')
    .insert({
      user_id: user.id,
      shared_url: url,
      share_intent: { url, title: null, text: null },
      status: 'pending',
      attempts: 0,
    })
    .select()
    .single()

  if (shareError || !share) {
    console.error('Failed to create share record:', shareError?.message)
    redirect('/recipes?add_error=server')
  }

  try {
    await inngest.send({
      name: 'recipe/extract',
      data: {
        shareId: share.id,
        sharedUrl: url,
        userId: user.id,
        sourceType,
      },
    })
  } catch (err) {
    console.error('Failed to trigger extraction:', err)
  }

  redirect('/recipes?shared=1')
}
