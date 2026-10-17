import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildFallbackMetaDescription } from '@/lib/recipe-tags'
import { Toast } from '@/app/components/toast'
import { PageContainer } from '@/app/components/page-container'
import { RecipeGallery } from '@/app/components/recipe-gallery'
import { buttonClasses } from '@/app/components/ui/button'
import { recipePath } from '@/lib/routes'
import { getSiteUrl } from '@/lib/site-url'
import { refreshRecipe } from './refresh-action'
import { loadRecipe } from './load-recipe'
import { parseIngredients, groupBySection } from '@/lib/ingredients'
import { parseSteps } from '@/lib/steps'
import { RECIPE_SHARED_MESSAGE } from '@/lib/recipe-delete'
import { RecipeHeader } from './_components/recipe-header'
import { RecipeActions } from './_components/recipe-actions'
import { RecipeChecklists } from './_components/recipe-checklists'
import { RecipeListBar } from './_components/recipe-list-bar'
import { LockedGallery } from './_components/locked-gallery'
import { SimilarRecipes } from './_components/similar-recipes'
import { loginPath } from '@/lib/login-redirect'
import { loadCategoryContext } from './category-context'
import { parseListKey } from '@/lib/recipe-list-context'

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
    // Absolute: the root layout sets no metadataBase, so a relative canonical would
    // resolve against Next's localhost fallback in production.
    alternates: { canonical: `${await getSiteUrl()}${recipePath(recipe.slug)}` },
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
  const { duplicate, refreshing, refresh_error, in_favorites, delete_error, from } = await searchParams

  const { recipe: typedRecipe, error, isOwner, user } = await loadRecipe(slug)

  if (error || !typedRecipe) {
    if (error) console.error('[recipe] Query error:', error)
    notFound()
  }

  // The gallery is a login perk (decision Q3) and favorites are private (owner-only
  // RLS): both need a session. The list bar's category context (E01-S07) is
  // guest-safe. All three run in parallel on one client.
  const supabase = await createSupabaseServerClient()
  const [categoryContext, gallery, favorite] = await Promise.all([
    loadCategoryContext(supabase, typedRecipe),
    user ? supabase.from('recipe_gallery_images').select('image_urls').eq('id', typedRecipe.id).maybeSingle() : null,
    user
      ? supabase.from('favorites').select('recipe_id').eq('user_id', user.id).eq('recipe_id', typedRecipe.id).maybeSingle()
      : null,
  ])
  const galleryImages: string[] = gallery?.data?.image_urls ?? []
  const isFavorite = Boolean(favorite?.data)
  const galleryCount = typedRecipe.gallery_count ?? 0

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
      {refresh_error === 'no_access' && (
        <Toast message="Odświeżanie przepisów wymaga kodu dostępu." type="error" duration={5000} clearParam="refresh_error" />
      )}
      {/* Not `narrow`: the desktop layout (E01-S17, A9) uses the full 1152 px; below lg
          both widths are the viewport anyway. */}
      <PageContainer>
        <RecipeListBar slug={typedRecipe.slug} from={parseListKey(from)} fallback={categoryContext} />
        <RecipeHeader recipe={typedRecipe} />
        <RecipeActions
          recipeId={typedRecipe.id}
          isFavorite={isFavorite}
          isAuthenticated={Boolean(user)}
        />
        {/* Video and gallery sit in the steps column from lg (E01-S17); below lg they
            follow the steps exactly as before. */}
        <RecipeChecklists
          recipeId={typedRecipe.id}
          title={typedRecipe.title}
          ingredientGroups={ingredientGroups}
          steps={steps}
        >
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
          {!user && galleryCount > 1 && (
            <LockedGallery count={galleryCount} loginHref={loginPath(recipePath(typedRecipe.slug))} />
          )}
        </RecipeChecklists>

        <SimilarRecipes recipe={typedRecipe} />

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
