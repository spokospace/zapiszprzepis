import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'
import { resolveLoginNext } from '@/lib/login-redirect'
import { welcome } from '@/lib/vocative'
import { avatarColorIndex, avatarUrl } from '@/lib/avatar'
import { SUPABASE_URL } from '@/lib/env'
import { Avatar } from '@/app/components/ui/avatar'
import { GenderForm } from './gender-form'

export const metadata: Metadata = {
  title: 'Witaj · Zapisz Przepis',
  robots: { index: false },
}

type SearchParams = Promise<{ next?: string; error?: string }>

// E01-S12, screen 3b: the one-time gender choice after the first login.
// Middleware already requires a session for this path.
export default async function WelcomePage({ searchParams }: { searchParams: SearchParams }) {
  const { next: rawNext, error } = await searchParams
  const origin = new URL(await getSiteUrl()).origin
  const next = resolveLoginNext(rawNext, origin, '/')

  const { supabase, user } = await requireUser()
  const [{ data: priv }, { data: profile }] = await Promise.all([
    supabase.from('profiles_private').select('gender').eq('id', user.id).maybeSingle<{ gender: string | null }>(),
    supabase
      .from('profiles')
      .select('display_name, avatar_path, avatar_color')
      .eq('id', user.id)
      .maybeSingle<{ display_name: string; avatar_path: string | null; avatar_color: number | null }>(),
  ])

  // Already chosen — the choice is final, so there is nothing to do here.
  if (priv?.gender) {
    redirect(next)
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-1 flex-col gap-5">
        <Avatar
          src={avatarUrl(SUPABASE_URL, profile?.avatar_path)}
          name={profile?.display_name ?? ''}
          colorIndex={avatarColorIndex(user.id, profile?.avatar_color)}
          size={80}
        />
        <h1 className="text-[30px] font-bold leading-tight text-ink">{welcome(profile?.display_name)}</h1>
        <p className="text-[18px] leading-normal text-ink-soft">Jeszcze jedno pytanie, żeby dobrze się do Ciebie zwracać.</p>
        <GenderForm next={next} error={error} />
      </div>
    </main>
  )
}
