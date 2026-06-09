'use server'

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'
import { inngest } from '@/inngest/client'

function detectSourceType(url: string): 'facebook_text' | 'web_blog' {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'facebook.com' || host === 'fb.watch' || host === 'fb.me') {
      return 'facebook_text'
    }
  } catch {
    // malformed URL — treat as web_blog
  }
  return 'web_blog'
}

export async function triggerRecipeExtraction(
  url: string,
  title?: string,
  text?: string
) {
  // Get authenticated user
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Create recipe_share record
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

  const sourceType = detectSourceType(url)

  // Trigger extraction task via Inngest
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
    // Log error but don't fail the share submission
    console.error('Failed to trigger extraction task:', error)
  }

  return {
    shareId: share.id,
    message: 'Zapisałem — przepis pojawi się za chwilę',
  }
}
