import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getFailedShares } from '@/lib/failed-shares'
import { AppHeader } from '@/app/components/app-header'
import { AddRecipeForm } from '@/app/components/add-recipe-form'
import { RecipeCard } from '@/app/components/recipe-card'

type SearchParams = Promise<{ add_error?: string }>

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { add_error } = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [failedShares, { data: recentRecipes }] = await Promise.all([
    getFailedShares(supabase),
    supabase
      .from('recipes')
      .select('slug, title, image_url, category')
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  return (
    <>
      <AppHeader failedShares={failedShares} />
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <p className="mb-6 text-sm text-gray-500">Znajdź przepis i zapisz go jednym kliknięciem.</p>
          <AddRecipeForm addError={add_error} />
          {recentRecipes && recentRecipes.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Ostatnio dodane
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {recentRecipes.map((r) => (
                  <RecipeCard
                    key={r.slug}
                    slug={r.slug}
                    title={r.title}
                    imageUrl={r.image_url}
                    category={r.category}
                  />
                ))}
              </div>
            </div>
          )}
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
