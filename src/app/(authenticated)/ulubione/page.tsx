import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getSignedInUser } from '@/lib/supabase/server'
import { loginPath } from '@/lib/login-redirect'
import { PageContainer } from '@/app/components/page-container'
import { RecipeCard, TILE_SIZES_1_TO_3 } from '@/app/components/recipe-card'
import { RecipeListSnapshot } from '@/app/components/recipe-list-snapshot'
import type { RecipeSource } from '@/lib/recipe-source'

export const metadata: Metadata = { title: 'Ulubione · Zapisz Przepis' }

type FavoriteCard = {
  id: number
  slug: string
  title: string
  image_url: string | null
  category: string
  description: string | null
  source_type: RecipeSource
  source_url: string | null
  source_author: string | null
}

/**
 * The signed-in user's favorites, newest first (E01-S06). Minimal on purpose:
 * the "Ulubione" search scope is E01-S05, the menu counters E01-S09.
 */
export default async function FavoritesPage() {
  const user = await getSignedInUser()
  if (!user) redirect(loginPath('/ulubione'))

  const supabase = await createSupabaseServerClient()
  // One round trip: favorites are private (owner-only RLS), and the recipe for each
  // is embedded from the guest-safe view, which covers everyone's recipes, not just
  // the user's own. The FK favorites.recipe_id → recipes(id) lets PostgREST embed
  // public_recipes (a plain view over recipes) through it (#231).
  const { data: favorites } = await supabase
    .from('favorites')
    .select(
      'recipe:public_recipes(id, slug, title, image_url, category, description, source_type, source_url, source_author)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    // favorites.recipe_id → recipes(id) is many-to-one, so `recipe` is a single
    // row (or null), not a list; override the array embed PostgREST-js infers for
    // a view relationship absent from the generated types.
    .returns<{ recipe: FavoriteCard | null }[]>()

  // Newest-first order comes from the query; drop any favorite whose recipe is gone.
  const recipes = (favorites ?? [])
    .map((f) => f.recipe)
    .filter((r): r is FavoriteCard => Boolean(r))

  return (
    <main className="min-h-screen bg-white">
      <PageContainer className="py-6 sm:py-12">
        <h1 className="mb-6 text-2xl font-bold text-ink">Ulubione</h1>
        {recipes.length === 0 ? (
          <p className="max-w-prose text-[18px] text-ink-soft">
            Nie masz jeszcze ulubionych przepisów. Otwórz przepis i kliknij „Dodaj do ulubionych”.
          </p>
        ) : (
          // One card a row on a phone, so its photo spans the screen; three from sm.
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <RecipeListSnapshot
              listKey="fav"
              label="Ulubione"
              href="/ulubione"
              items={recipes.map((r) => ({ slug: r.slug, title: r.title }))}
            />
            {recipes.map((r) => (
              <RecipeCard
                key={r.id}
                from="fav"
                slug={r.slug}
                title={r.title}
                imageUrl={r.image_url}
                category={r.category}
                description={r.description}
                sourceType={r.source_type}
                sourceUrl={r.source_url}
                sourceAuthor={r.source_author}
                favorite={{ recipeId: r.id, favorited: true, isAuthenticated: true }}
                sizes={TILE_SIZES_1_TO_3}
              />
            ))}
          </div>
        )}
      </PageContainer>
    </main>
  )
}
