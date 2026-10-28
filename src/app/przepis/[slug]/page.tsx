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
import { buildRecipeJsonLd, serializeJsonLd } from '@/lib/recipe-json-ld'
import { coverImageSrc } from '@/lib/recipe-image-archive'
import { refreshRecipe } from './refresh-action'
import { loadRecipe } from './load-recipe'
import { parseIngredients, groupBySection } from '@/lib/ingredients'
import { parseSteps, visibleStepImages } from '@/lib/steps'
import { RECIPE_SHARED_MESSAGE } from '@/lib/recipe-delete'
import { RecipeBreadcrumbs, RecipeHeader } from './_components/recipe-header'
import { RecipeActions } from './_components/recipe-actions'
import { RecipeChecklists } from './_components/recipe-checklists'
import { RecipeListBar, RecipeListNav } from './_components/recipe-list-bar'
import { LockedGallery } from './_components/locked-gallery'
import { SimilarRecipes } from './_components/similar-recipes'
import { DishVersionsBar } from './_components/dish-versions-bar'
import { DishVersions } from './_components/dish-versions'
import { parseVersionsSort, type DishVersionRow } from '@/lib/dish-versions'
import { getFavoriteIds } from '@/lib/favorites'
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
  // og:image/twitter only from an archived Storage cover — never a legacy external
  // link (the image_url invariant), so no third-party URL lands in the page's meta.
  const cover = coverImageSrc(recipe.image_url)
  const images = cover ? [cover] : undefined
  const canonical = `${await getSiteUrl()}${recipePath(recipe.slug)}`
  return {
    title: recipe.title,
    description,
    // ?from= list-context variants (E01-S07) must not compete with the canonical URL.
    // Absolute: the root layout sets no metadataBase, so a relative canonical would
    // resolve against Next's localhost fallback in production.
    // The .md alternate (#363) advertises the AI-citable Markdown rendering.
    alternates: { canonical, types: { 'text/markdown': `${canonical}.md` } },
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
    /** Version sort order (E01-S21); whitelisted, falls back to popularne. */
    wersje?: string
  }>
}

export default async function RecipeDetailPage({ params, searchParams }: RecipeDetailPageProps) {
  const { slug } = await params
  const { duplicate, refreshing, refresh_error, in_favorites, delete_error, from, wersje } = await searchParams

  const { recipe: typedRecipe, error, isOwner, user } = await loadRecipe(slug)

  if (error || !typedRecipe) {
    if (error) console.error('[recipe] Query error:', error)
    notFound()
  }

  // The gallery is a login perk (decision Q3) and favorites are private (owner-only
  // RLS): both need a session. The list bar's category context (E01-S07) is
  // guest-safe. All three run in parallel on one client.
  // The "versions of the same dish" RPC (E01-S21) runs ONLY when this recipe has
  // a dish — until the #298 backfill lands, dish is null everywhere, so no call
  // is made and no bar/section renders (empty-data state).
  const supabase = await createSupabaseServerClient()
  const [categoryContext, gallery, favorite, dishVersionsResult] = await Promise.all([
    loadCategoryContext(supabase, typedRecipe),
    user ? supabase.from('recipe_gallery_images').select('image_urls').eq('id', typedRecipe.id).maybeSingle() : null,
    user
      ? supabase.from('favorites').select('recipe_id').eq('user_id', user.id).eq('recipe_id', typedRecipe.id).maybeSingle()
      : null,
    typedRecipe.dish ? supabase.rpc('dish_versions', { p_recipe_id: typedRecipe.id }) : null,
  ])
  const galleryImages: string[] = gallery?.data?.image_urls ?? []
  const isFavorite = Boolean(favorite?.data)
  const galleryCount = typedRecipe.gallery_count ?? 0

  // An RPC error is non-critical: log it and hide the feature (treat as []).
  if (dishVersionsResult?.error) console.error('[recipe] dish_versions failed:', dishVersionsResult.error)
  const versions = (dishVersionsResult?.data ?? []) as DishVersionRow[]
  const versionsTotal = versions[0]?.total_count ?? 0
  // The hearts on the version cards: the viewer's favorites among them (null = guest).
  const versionFavoriteIds = user ? await getFavoriteIds(supabase, user.id, versions.map((v) => v.id)) : null
  const versionsOrder = parseVersionsSort(wersje)
  const currentRecipe = {
    servings: typedRecipe.servings,
    prep_time_minutes: typedRecipe.prep_time_minutes,
    cook_time_minutes: typedRecipe.cook_time_minutes,
    total_time_minutes: typedRecipe.total_time_minutes,
    times_estimated: typedRecipe.times_estimated,
    ingredients: typedRecipe.ingredients,
  }

  // Parse the jsonb ingredients and steps. Both parsers are crash-safe (an RSC
  // exception is a full page crash, which would also hide the delete button);
  // groupBySection splits ingredients by optional `section`.
  const ingredientGroups = groupBySection(parseIngredients(typedRecipe.ingredients))
  const steps = parseSteps(typedRecipe.steps)
  // Per-step photos, index-aligned with steps; empty until the column/view migration
  // and an import that captures them land (recipes without them render exactly as today).
  // Signed-in users only: a guest gets plain step text, with no photo or toggle.
  const stepImages = visibleStepImages(typedRecipe.step_images, Boolean(user))
  const listKey = parseListKey(from)
  const siteUrl = await getSiteUrl()
  const canonicalUrl = `${siteUrl}${recipePath(typedRecipe.slug)}`
  // schema.org/Recipe for Google rich results. Built from guest-safe fields only
  // (no gallery, no step photos): Googlebot is anonymous, so the markup must match
  // what an anonymous visitor sees. No rating/nutrition — we store neither.
  const recipeJsonLd = serializeJsonLd(buildRecipeJsonLd(typedRecipe, siteUrl))

  return (
    <main className="min-h-screen bg-white py-6 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: recipeJsonLd }} />
      {duplicate === '1' && (
        <Toast message="Ten przepis już masz." type="info" duration={5000} clearParam="duplicate" />
      )}
      {in_favorites === '1' && (
        <Toast
          message="Ten przepis już jest w aplikacji Zapisz Przepis. Dodaliśmy go do Twoich ulubionych."
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
        {/* The action cards sit last in the header's text column, under the description,
            so from lg they share the row with the photo. The cooking button and the steps
            list far below share the step-photos toggle through the module-level
            useStepPhotos store, so „Ukryj” reaches both. */}
        <RecipeHeader
          recipe={typedRecipe}
          listBar={
            // A9: from lg, the list position and the breadcrumbs share one row above the title.
            <div className="lg:flex lg:items-center lg:gap-6">
              <RecipeListBar slug={typedRecipe.slug} from={listKey} fallback={categoryContext} />
              <RecipeBreadcrumbs category={typedRecipe.category} className="hidden lg:ml-auto lg:block lg:self-start" />
            </div>
          }
          versionsBar={
            versionsTotal > 0 ? (
              <DishVersionsBar count={versionsTotal} dishAccusative={typedRecipe.dish_accusative ?? null} />
            ) : undefined
          }
          actions={
            <RecipeActions
              recipeId={typedRecipe.id}
              isFavorite={isFavorite}
              isAuthenticated={Boolean(user)}
              title={typedRecipe.title}
              shareUrl={canonicalUrl}
              steps={steps}
              stepImages={stepImages}
            />
          }
        />
        {/* Video and gallery sit in the steps column from lg (E01-S17); below lg they
            follow the steps exactly as before. */}
        <RecipeChecklists
          recipeId={typedRecipe.id}
          ingredientGroups={ingredientGroups}
          steps={steps}
          stepImages={stepImages}
          servings={typedRecipe.servings}
        >
          {typedRecipe.youtube_id && (
            <section className="mb-12 print:hidden">
              <h2 className="mb-4 text-[24px] font-bold text-ink">Wideo</h2>
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
            <div className="print:hidden">
              <RecipeGallery images={galleryImages} title={typedRecipe.title} />
            </div>
          )}
          {/* A guest gets a locked teaser with the count only (E01-S07). */}
          {!user && galleryCount > 1 && (
            <div className="print:hidden">
              <LockedGallery count={galleryCount} loginHref={loginPath(recipePath(typedRecipe.slug))} />
            </div>
          )}
        </RecipeChecklists>

        {/* The end of the recipe (handoff C3, items 12–13): Poprzedni / Następny, then
            the tags and similar recipes. The original is reached from the source badge
            on the photo now (E01-S31 §3), so there is no "Otwórz oryginał" button here.
            All of it is screen-only — a printout stops at the recipe itself. */}
        <div className="print:hidden">
          <RecipeListNav slug={typedRecipe.slug} from={listKey} fallback={categoryContext} />

          <DishVersions
            versions={versions}
            totalCount={versionsTotal}
            dish={typedRecipe.dish ?? null}
            favoriteIds={versionFavoriteIds}
            order={versionsOrder}
            current={currentRecipe}
          />

          <SimilarRecipes recipe={typedRecipe} userId={user?.id ?? null} />
        </div>

        {isOwner && delete_error === 'shared' && (
          <p role="alert" className="mb-4 border-t border-border-card pt-8 text-[17px] font-bold text-danger print:hidden">
            {RECIPE_SHARED_MESSAGE}
          </p>
        )}
        {isOwner && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-card pt-8 print:hidden">
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
    </main>
  )
}
