import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFavoriteIds } from '@/lib/favorites'
import { categoryLabel, isRecipeCategory } from '@/lib/recipe-categories'
import { PageContainer } from '@/app/components/page-container'
import { RecipeCard } from '@/app/components/recipe-card'

type Params = Promise<{ kategoria: string }>

// Newest first; paging and tag filters arrive with E01-S16.
const LIMIT = 48

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { kategoria: category } = await params
  if (!isRecipeCategory(category)) return {}
  return { title: `${categoryLabel(category)} · ZapiszPrzepis` }
}

/**
 * Every recipe in one category, for guests too (E01-S09: the MENU category
 * grid and the home tiles land here). A minimal listing on the route E01-S16
 * later extends with tag chips. Reads the guest-safe public_recipes view; an
 * unknown category is a 404, an empty one an empty state.
 */
export default async function CategoryPage({ params }: { params: Params }) {
  const { kategoria: category } = await params
  if (!isRecipeCategory(category)) notFound()

  const supabase = await createSupabaseServerClient()
  const [user, { data: recipes, error }] = await Promise.all([
    getCurrentUser(),
    supabase
      .from('public_recipes')
      .select('id, slug, title, image_url, category, description, source_type, source_url, source_author')
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(LIMIT),
  ])

  if (error) {
    // Let the route error boundary say so instead of a misleading empty state.
    throw new Error(`[przepisy] Query failed: ${error.message}`)
  }

  // The labelled heart on each card (E01-S06); favorites are private, so only with a session.
  const ids = (recipes ?? []).map((r) => r.id)
  const favoriteIds = user ? await getFavoriteIds(supabase, user.id, ids) : new Set<number>()

  return (
    <main className="min-h-screen bg-surface">
      <PageContainer className="py-6 sm:py-12">
        <h1 className="mb-6 text-2xl font-bold text-ink">{categoryLabel(category)}</h1>
        {!recipes || recipes.length === 0 ? (
          <p className="max-w-prose text-[18px] text-ink-soft">
            W tej kategorii nie ma jeszcze przepisów.{' '}
            <Link href="/" className="font-semibold text-action-text underline underline-offset-4 hover:text-action-hover">
              Wróć na stronę główną
            </Link>
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
                favorite={{ recipeId: r.id, favorited: favoriteIds.has(r.id), isAuthenticated: Boolean(user) }}
              />
            ))}
          </div>
        )}
      </PageContainer>
    </main>
  )
}
