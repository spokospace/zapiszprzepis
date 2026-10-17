import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SUPABASE_URL } from '@/lib/env'
import { avatarColorIndex, avatarUrl } from '@/lib/avatar'
import { profilePath } from '@/lib/routes'
import { genderFormOf, youAddedLine } from '@/lib/gender-form'
import { signOut } from '@/app/(actions)/sign-out'
import { PageContainer } from '@/app/components/page-container'
import { Button } from '@/app/components/ui/button'
import { SettingsForm } from './settings-form'

export const metadata: Metadata = { title: 'Ustawienia · ZapiszPrzepis' }

type ProfileRow = {
  display_name: string
  username: string
  avatar_path?: string | null
  avatar_color?: number | null
}

// Screen 2a (E01-S13). Deliberately shows neither gender (chosen once, not
// editable — S12) nor the username (immutable — S18).
export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, priv, own] = await Promise.all([
    readProfile(supabase, user.id),
    // Owner-only RLS; a read error just means "no first name / gender yet".
    supabase
      .from('profiles_private')
      .select('first_name, gender')
      .eq('id', user.id)
      .maybeSingle<{ first_name: string | null; gender: string | null }>(),
    // How many recipes this person added (owner-only recipes RLS), for "Dodałaś N przepisów".
    supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  return (
    <main className="min-h-screen bg-white">
      <PageContainer narrow className="py-6 sm:py-12">
        <h1 className="mb-6 text-[30px] leading-tight font-bold text-ink">Ustawienia</h1>
        <SettingsForm
          initialDisplayName={profile?.display_name ?? ''}
          initialFirstName={priv.data?.first_name ?? ''}
          avatarSrc={avatarUrl(SUPABASE_URL, profile?.avatar_path)}
          colorIndex={avatarColorIndex(user.id, profile?.avatar_color)}
          profileHref={profilePath(profile?.username)}
          // Only the finished sentence reaches the client, never the gender (E01-S23).
          addedLine={youAddedLine(genderFormOf(priv.data?.gender), own.count ?? 0)}
        />
        <dl className="mt-8 border-t border-border-card pt-5">
          <dt className="text-[16px] text-ink-soft">Adres email</dt>
          <dd className="mt-1 text-[19px] font-semibold break-all text-ink">{user.email ?? '—'}</dd>
        </dl>
        <form action={signOut} className="mt-8 border-t border-border-card pt-5">
          <Button type="submit" variant="outline" size="md" className="w-full">
            Wyloguj
          </Button>
        </form>
      </PageContainer>
    </main>
  )
}

/**
 * The public profile row. Falls back to the pre-S13 columns while the
 * 20261017181300 migration is not applied, so the page still renders (letter
 * avatar) instead of losing the display name.
 */
async function readProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<ProfileRow | null> {
  const full = await supabase
    .from('profiles')
    .select('display_name, username, avatar_path, avatar_color')
    .eq('id', userId)
    .maybeSingle<ProfileRow>()
  if (!full.error) return full.data
  const legacy = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', userId)
    .maybeSingle<ProfileRow>()
  return legacy.data
}
