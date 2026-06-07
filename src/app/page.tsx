import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { signOut } from './(actions)/sign-out'

export default async function HomePage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1>
          <Image
            src="/logo.svg"
            alt="ZapiszPrzepis"
            width={1970}
            height={668}
            priority
            unoptimized
            className="block h-auto w-48"
          />
        </h1>
        <p className="mt-4 text-sm text-zinc-600">
          Zalogowano jako <span className="font-medium">{user.email}</span>.
        </p>
        <div className="mt-6 space-y-3">
          <Link
            href="/recipes"
            className="block w-full text-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition"
          >
            Moje przepisy
          </Link>
          <form action={signOut} className="w-full">
            <button
              type="submit"
              className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Wyloguj się
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
