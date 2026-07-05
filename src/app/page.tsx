import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getFailedShares } from '@/lib/failed-shares'
import { AppHeader } from '@/app/components/app-header'
import { AddRecipeForm } from '@/app/components/add-recipe-form'

type SearchParams = Promise<{ add_error?: string }>

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { add_error } = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const failedShares = await getFailedShares(supabase)

  return (
    <>
      <AppHeader failedShares={failedShares} />
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="mb-8">
            <Image
              src="/logo.svg"
              alt="ZapiszPrzepis"
              width={1970}
              height={668}
              priority
              unoptimized
              className="block h-auto w-40"
            />
            <p className="mt-2 text-sm text-gray-500">Znajdź przepis i zapisz go jednym kliknięciem.</p>
          </div>
          <AddRecipeForm addError={add_error} />
          <Link
            href="/recipes"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-orange-200 bg-orange-50 px-6 py-4 text-base font-semibold text-orange-700 shadow-sm hover:bg-orange-100 hover:border-orange-300 transition-colors"
          >
            Zapisane przepisy →
          </Link>
        </div>
      </main>
    </>
  )
}
