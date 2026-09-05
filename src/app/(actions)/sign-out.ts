'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  // scope:'local' drops this device's session only. The supabase-js default is
  // 'global', which revokes every refresh token the user has — one person hitting
  // "Wyloguj" would then sign the other device out too, and that device only gets
  // back in through a fresh magic link. This is a shared account across two
  // devices, and the product promise is that the phone stays signed in.
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}
