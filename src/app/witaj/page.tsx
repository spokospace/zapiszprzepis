import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'
import { resolveLoginNext } from '@/lib/login-redirect'
import { greeting } from '@/lib/vocative'
import { GenderForm } from './gender-form'

export const metadata: Metadata = {
  title: 'Witaj — ZapiszPrzepis',
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
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle<{ display_name: string }>(),
  ])

  // Already chosen — the choice is final, so there is nothing to do here.
  if (priv?.gender) {
    redirect(next)
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-5">
        <Image
          src="/logo.svg"
          alt="ZapiszPrzepis"
          width={1970}
          height={668}
          priority
          unoptimized
          className="block h-auto w-40"
        />
        <h1 className="text-[32px] font-bold leading-tight text-ink">{greeting(profile?.display_name)}</h1>
        <p className="text-[19px] text-ink">Jedno pytanie na start.</p>
        <GenderForm next={next} error={error} />
      </div>
    </main>
  )
}
