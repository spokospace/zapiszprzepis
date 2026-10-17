import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { buildFallbackMetaDescription } from '@/lib/recipe-tags'
import { Toast } from '@/app/components/toast'
import { PageContainer } from '@/app/components/page-container'
import { RecipeGallery } from '@/app/components/recipe-gallery'
import { buttonClasses } from '@/app/components/ui/button'
import { recipePath } from '@/lib/routes'
import { refreshRecipe } from './refresh-action'
import { parseIngredients, groupBySection } from '@/lib/ingredients'
import { parseSteps } from '@/lib/steps'
import { RECIPE_SHARED_MESSAGE } from '@/lib/recipe-delete'
import type { Database } from '@/lib/supabase.types'
import { RecipeHeader } from './_components/recipe-header'
import { RecipeActions } from './_components/recipe-actions'
import { RecipeChecklists } from './_components/recipe-checklists'
import { RecipeListBar } from './_components/recipe-list-bar'
import { LockedGallery } from './_components/locked-gallery'
import { loginPath } from '@/lib/login-redirect'
import { loadCategoryContext } from './category-context'
import { parseListKey } from '@/lib/recipe-list-context'

type Recipe = Database['public']['Tables']['recipes']['Row']

/** A row of the guest-safe public_recipes view: no user_id, no gallery, plus the author. */
type PublicRecipe = Omit<Recipe, 'user_id' | 'image_urls' | 'source_fingerprint' | 'extracted_at' | 'updated_at'> & {
  author_name: string | null
  /** Optional until the E01-S07 view migration is applied; the page degrades without them. */
  author_username?: string | null
  gallery_count?: number | null
}

/**
 * One guest-safe read of the recipe for this slug, shared by generateMetadata
 * and the page through React cache() so a single render hits the DB once.
 * Everyone reads through the public_recipes view (recipes itself is owner-only
 * RLS). The slug resolves to the oldest row — the one that keeps the bare slug
 * once E01-S03b's global-unique slug migration lands; until then two genuinely
 * different recipes may still share a title, so the oldest (created_at, then id)
 * is the deterministic, link-stable winner. `isOwner` is the signed-in visitor
 * owning that row (refresh/delete are the owner's; others only read).
 */
const loadRecipe = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  const [{ data: rows, error }, { data: own }] = await Promise.all([
    supabase
      .from('public_recipes')
      .select('*')
      .eq('slug', slug)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1),
    // (user_id, slug) is unique per user, so at most one own row for this slug.
    user
      ? supabase.from('recipes').select('id').eq('slug', slug).eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const recipe = ((rows ?? []) as PublicRecipe[])[0] ?? null
  return { recipe, error, isOwner: own?.id != null && recipe?.id === own.id, user }
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  // Crawlers and link-preview bots are anonymous, so the metadata describes what
  // a guest sees; meta_description falls back to a self-derived sentence.
  const { recipe } = await loadRecipe(slug)
  if (!recipe) return { title: 'Przepis', description: 'Szczegóły przepisu' }

  const description = recipe.meta_description ?? buildFallbackMetaDescription(recipe)
  const images = recipe.image_url ? [recipe.image_url] : undefined
  return {
    title: recipe.title,
    description,
    // ?from= list-context variants (E01-S07) must not compete with the canonical URL.
    alternates: { canonical: recipePath(recipe.slug) },
    openGraph: {
      title: recipe.title,
      description,
      type: 'article',
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: recipe.title,
      description,
    },
  }
}

interface RecipeDetailPageProps {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    duplicate?: string
    refreshing?: string
    refresh_error?: string
    /** Set by the guest heart's login round-trip: add this recipe to favorites (E01-S06). */
    fav?: string
    /** The link was someone else's recipe; it was added to favorites instead (E01-S03a). */
    in_favorites?: string
    /** The delete was refused: others have this recipe as a favorite (E01-S03a). */
    delete_error?: string
    /** The list the visitor came from, for the list bar (E01-S07); whitelisted. */
    from?: string
  }>
}

export default async function RecipeDetailPage({ params, searchParams }: RecipeDetailPageProps) {
  const { slug } = await params
  const { duplicate, refreshing, refresh_error, fav, in_favorites, delete_error, from } = await searchParams

  const { recipe: typedRecipe, error, isOwner, user } = await loadRecipe(slug)

  if (error || !typedRecipe) {
    if (error) console.error('[recipe] Query error:', error)
    notFound()
  }

  // The gallery is a login perk (decision Q3). recipe_gallery_images is granted to
  // signed-in users only, so a guest cannot read it through the API either.
  // The gallery is a login perk (decision Q3); favorites are private (owner-only
  // RLS). Both reads need a session, so they share one client and one round trip.
  // The list bar's category context (E01-S07) is guest-safe and runs alongside.
  const supabase = await createSupabaseServerClient()
  const [categoryContext, [{ data: gallery }, { data: favorite }]] = await Promise.all([
    loadCategoryContext(supabase, typedRecipe),
    user
      ? Promise.all([
          supabase.from('recipe_gallery_images').select('image_urls').eq('id', typedRecipe.id).maybeSingle(),
          supabase.from('favorites').select('recipe_id').eq('user_id', user.id).eq('recipe_id', typedRecipe.id).maybeSingle(),
        ])
      : Promise.resolve([{ data: null }, { data: null }] as const),
  ])
  const galleryImages: string[] = gallery?.image_urls ?? []
  const isFavorite = Boolean(favorite)

  // Parse the jsonb ingredients and steps. Both parsers are crash-safe (an RSC
  // exception is a full page crash, which would also hide the delete button);
  // groupBySection splits ingredients by optional `section`.
  const ingredientGroups = groupBySection(parseIngredients(typedRecipe.ingredients))
  const steps = parseSteps(typedRecipe.steps)

  return (
    <div className="min-h-screen bg-white py-6 sm:py-8">
      {duplicate === '1' && (
        <Toast message="Ten przepis już masz." type="info" duration={5000} clearParam="duplicate" />
      )}
      {in_favorites === '1' && (
        <Toast
          message="Ten przepis już jest w ZapiszPrzepis. Dodaliśmy go do Twoich ulubionych."
          type="info"
          duration={5000}
          clearParam="in_favorites"
        />
      )}
      {refreshing === '1' && (
        <Toast message="Odświeżam przepis — zmiany pojawią się za chwilę." type="success" duration={5000} clearParam="refreshing" />
      )}
      {refresh_error === '1' && (
        <Toast message="Nie można odświeżyć — przepis nie ma źródłowego adresu." type="error" duration={5000} clearParam="refresh_error" />
      )}
      <PageContainer narrow>
        <RecipeListBar slug={typedRecipe.slug} from={parseListKey(from)} fallback={categoryContext} />
        <RecipeHeader recipe={typedRecipe} isAuthenticated={Boolean(user)} />
        <RecipeActions
          recipeId={typedRecipe.id}
          slug={typedRecipe.slug}
          isFavorite={isFavorite}
          isAuthenticated={Boolean(user)}
          autoAddFavorite={fav === '1' && Boolean(user)}
        />
        <RecipeChecklists recipeId={typedRecipe.id} ingredientGroups={ingredientGroups} steps={steps} />

        {typedRecipe.youtube_id && (
          <section className="mb-12">
            <h2 className="mb-4 text-[26px] font-bold text-ink">Wideo</h2>
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${typedRecipe.youtube_id}`}
                title={`${typedRecipe.title} — wideo`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </section>
        )}

        {/* A gallery of one would only repeat the cover. galleryImages is empty for a
            guest: the gallery view is not granted to anon (decision Q3). */}
        {galleryImages.length > 1 && (
          <RecipeGallery images={galleryImages} title={typedRecipe.title} />
        )}
        {/* A guest gets a locked teaser with the count only (E01-S07). */}
        {!user && (typedRecipe.gallery_count ?? 0) > 1 && (
          <LockedGallery count={typedRecipe.gallery_count ?? 0} loginHref={loginPath(recipePath(typedRecipe.slug))} />
        )}

        {/* E01-S16: <SimilarRecipes … /> ("Ten przepis jest" + "Podobne") */}

        {isOwner && delete_error === 'shared' && (
          <p role="alert" className="mb-4 border-t border-border-card pt-8 text-[17px] font-bold text-danger">
            {RECIPE_SHARED_MESSAGE}
          </p>
        )}
        {isOwner && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-card pt-8">
            <form action={refreshRecipe}>
              <input type="hidden" name="slug" value={typedRecipe.slug} />
              <button
                type="submit"
                className={buttonClasses('outline', 'md')}
              >
                Odśwież przepis
              </button>
            </form>
            <form action="/api/recipes/delete" method="POST">
              <input type="hidden" name="slug" value={typedRecipe.slug} />
              <button
                type="submit"
                className={buttonClasses('danger', 'md')}
              >
                Usuń przepis
              </button>
            </form>
          </div>
        )}
      </PageContainer>
    </div>
  )
}
