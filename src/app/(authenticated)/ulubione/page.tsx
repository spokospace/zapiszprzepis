import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { loginPath } from '@/lib/login-redirect'
import { PageContainer } from '@/app/components/page-container'
import { RecipeCard } from '@/app/components/recipe-card'
import type { RecipeSource } from '@/lib/recipe-source'

export const metadata: Metadata = { title: 'Ulubione · ZapiszPrzepis' }

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
  const user = await getCurrentUser()
  if (!user) redirect(loginPath('/ulubione'))

  const supabase = await createSupabaseServerClient()
  // Favorites are private (owner-only RLS); the recipes themselves come from the
  // guest-safe view, which covers everyone's recipes, not just the user's own.
  const { data: favorites } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const ids = (favorites ?? []).map((f) => f.recipe_id as number)
  const { data: rows } = ids.length
    ? await supabase
        .from('public_recipes')
        .select('id, slug, title, image_url, category, description, source_type, source_url, source_author')
        .in('id', ids)
    : { data: [] }

  const byId = new Map(((rows ?? []) as FavoriteCard[]).map((r) => [r.id, r]))
  const recipes = ids.map((id) => byId.get(id)).filter((r): r is FavoriteCard => Boolean(r))

  return (
    <main className="min-h-screen bg-white">
      <PageContainer className="py-6 sm:py-12">
        <h1 className="mb-6 text-2xl font-bold text-ink">Ulubione</h1>
        {recipes.length === 0 ? (
          <p className="max-w-prose text-[18px] text-ink-soft">
            Nie masz jeszcze ulubionych przepisów. Otwórz przepis i kliknij „Dodaj do ulubionych”.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {recipes.map((r) => (
              <RecipeCard
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
        )}
      </PageContainer>
    </main>
  )
}
