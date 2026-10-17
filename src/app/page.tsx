import Link from 'next/link'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFailedShares, NO_FAILED_SHARES } from '@/lib/failed-shares'
import { AppHeader } from '@/app/components/app-header'
import { AddRecipeForm } from '@/app/components/add-recipe-form'
import { AccessCodeGate } from '@/app/components/access-code-gate'
import { getFullAccess } from '@/lib/full-access'
import { RecipeCard } from '@/app/components/recipe-card'
import { PageContainer } from '@/app/components/page-container'

type SearchParams = Promise<{ add_error?: string }>

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { add_error } = await searchParams
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()

  // Public since E01-S02: a guest sees the home too. "Ostatnio dodane" is the
  // public feed across all users, read through the guest-safe public_recipes view
  // (recipes itself is owner-only), not the visitor's own list.
  // E01-S11: only full-access users get the add form; the rest see screen 3c.
  const [failedShares, hasFullAccess, { data: recentRecipes }] = await Promise.all([
    user ? getFailedShares(supabase, user.id) : Promise.resolve(NO_FAILED_SHARES),
    user ? getFullAccess(supabase) : Promise.resolve(false),
    supabase
      .from('public_recipes')
      .select('id, slug, title, image_url, category, description, source_type, source_url, source_author')
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  return (
    <>
      <AppHeader failedShares={failedShares} isAuthenticated={Boolean(user)} />
      <main className="min-h-screen bg-white">
        <PageContainer className="py-6 sm:py-12">
          {user ? (
            <>
              {hasFullAccess ? (
                <>
                  <p className="mb-6 text-sm text-gray-500">Znajdź przepis i zapisz go jednym kliknięciem.</p>
                  <AddRecipeForm addError={add_error} />
                </>
              ) : (
                <AccessCodeGate notice={add_error === 'no_access'} />
              )}
              <Link
                href="/recipes"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-orange-200 bg-orange-50 px-6 py-4 text-base font-semibold text-orange-700 shadow-sm hover:bg-orange-100 hover:border-orange-300 transition-colors"
              >
                Zapisane przepisy →
              </Link>
            </>
          ) : (
            <section aria-labelledby="guest-heading" className="rounded-xl bg-orange-50 px-5 py-6">
              <h1 id="guest-heading" className="text-2xl font-bold text-gray-900">
                Przepisy z całego internetu w jednym miejscu
              </h1>
              <p className="mt-2 text-base text-gray-700">
                Przeglądaj przepisy bez logowania. Zaloguj się, żeby zapisywać własne.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex min-h-[48px] items-center rounded-lg bg-orange-700 px-5 font-semibold text-white hover:bg-orange-800"
                >
                  Zaloguj się
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex min-h-[48px] items-center rounded-lg border-2 border-gray-500 px-5 font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Załóż konto
                </Link>
              </div>
            </section>
          )}
          {recentRecipes && recentRecipes.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Ostatnio dodane
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {recentRecipes.map((r) => (
                  <RecipeCard
                    // id, not slug: slugs are unique per user only, and this feed spans users.
                    key={r.id}
                    slug={r.slug}
                    title={r.title}
                    imageUrl={r.image_url}
                    category={r.category}
                    description={r.description}
                    sourceType={r.source_type}
                    sourceUrl={r.source_url}
                    sourceAuthor={r.source_author}
                  />
                ))}
              </div>
            </div>
          )}
        </PageContainer>
      </main>
    </>
  )
}
