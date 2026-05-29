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
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          ZapiszPrzepis
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Zalogowano jako <span className="font-medium">{user.email}</span>.
        </p>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
          (Placeholder fundamentu F-01. Lista przepisów dołączy w S-01.)
        </p>
        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Wyloguj się
          </button>
        </form>
      </div>
    </main>
  )
}
