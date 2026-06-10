'use server'

import { inngest } from '@/inngest/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { detectSourceType } from '@/lib/detect-source-type'

export async function triggerRecipeExtraction(
  url: string,
  title?: string,
  text?: string
) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const sourceType = detectSourceType(url)

  const { data: share, error: shareError } = await supabase
    .from('recipe_shares')
    .insert({
      user_id: user.id,
      shared_url: url,
      share_intent: {
        url,
        title: title || null,
        text: text || null,
      },
      status: 'pending',
      attempts: 0,
    })
    .select()
    .single()

  if (shareError || !share) {
    throw new Error(`Failed to create share record: ${shareError?.message}`)
  }

  try {
    await inngest.send({
      name: 'recipe/extract',
      data: {
        shareId: share.id,
        sharedUrl: url,
        sharedTitle: title,
        sharedText: text,
        userId: user.id,
        sourceType,
      },
    })
  } catch (error) {
    console.error('Failed to trigger extraction task:', error)
  }

  return {
    shareId: share.id,
    message: 'Zapisałem — przepis pojawi się za chwilę',
  }
}
