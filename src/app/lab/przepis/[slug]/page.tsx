import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageContainer } from '@/app/components/page-container'
import { TrackView } from '@/app/components/track-view'
import { getPublicRecipeLongLived } from '@/lib/recipe-cache'
import { LAB_SLUGS } from '../../slugs'
import { createSupabaseAnonClient } from '@/lib/supabase/anon'
import { recipePath } from '@/lib/routes'
import { buildRecipeBreadcrumbJsonLd, buildRecipeJsonLd, serializeJsonLd } from '@/lib/recipe-json-ld'
import { parseIngredients, groupBySection } from '@/lib/ingredients'
import { parseSteps, visibleStepImages } from '@/lib/steps'
import { findGlossaryTerms } from '@/lib/ingredient-glossary'
import { parseVersionsSort, type DishVersionRow } from '@/lib/dish-versions'
import { loginPath } from '@/lib/login-redirect'
import { formatSource } from '@/lib/recipe-source'
import { loadCategoryContext } from '@/app/przepis/[slug]/category-context'
import { recipeMetadata } from '@/app/przepis/[slug]/recipe-metadata'
import { RecipeBreadcrumbs, RecipeHeader } from '@/app/przepis/[slug]/_components/recipe-header'
import { RecipeActions } from '@/app/przepis/[slug]/_components/recipe-actions'
import { RecipeChecklists } from '@/app/przepis/[slug]/_components/recipe-checklists'
import { RecipeListBar, RecipeListNav } from '@/app/przepis/[slug]/_components/recipe-list-bar'
import { LockedGallery } from '@/app/przepis/[slug]/_components/locked-gallery'
import { SimilarRecipes } from '@/app/przepis/[slug]/_components/similar-recipes'
import { DishVersionsBar } from '@/app/przepis/[slug]/_components/dish-versions-bar'
import { DishVersions } from '@/app/przepis/[slug]/_components/dish-versions'
import { PostSiblings, type PostSibling } from '@/app/przepis/[slug]/_components/post-siblings'
import { RECIPE_MAIN, RECIPE_TOP_ROW } from '@/app/przepis/[slug]/_components/recipe-split'

/**
 * Spec A proof, branch preview only, never merged: the real recipe tree for a guest with no
 * per-request input. Same blocks and reads as `/przepis/{slug}`, through the anon client.
 */
export const revalidate = 3600

// Pre-render every recipe at build time, outside the Worker's CPU limit, so a visitor never
// causes a miss. New recipes still render on their first visit.
export async function generateStaticParams() {
  const { data, error } = await createSupabaseAnonClient().from('public_recipes').select('slug').limit(1000)
  if (error) throw new Error(`[lab] slug list failed: ${error.message}`)
  return (data ?? []).map((row) => ({ slug: row.slug as string }))
}

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://zapiszprzepis.pl').replace(/\/$/, '')

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const recipe = await getPublicRecipeLongLived(slug)
  if (!recipe) return { title: 'Przepis', robots: { index: false, follow: false } }
  return { ...recipeMetadata(recipe, siteUrl()), robots: { index: false, follow: false } }
}

export default async function RecipeLabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (process.env.RECIPE_LAB !== '1') notFound()
  const recipe = await getPublicRecipeLongLived(slug)
  if (!recipe) notFound()

  const supabase = createSupabaseAnonClient()
  const [categoryContext, dishVersionsResult, siblingsResult] = await Promise.all([
    loadCategoryContext(supabase as unknown as Parameters<typeof loadCategoryContext>[0], recipe),
    recipe.dish ? supabase.rpc('dish_versions', { p_recipe_id: recipe.id }) : null,
    recipe.source_url
      ? supabase.from('public_recipes').select('id, slug, title').eq('source_url', recipe.source_url).neq('id', recipe.id)
      : null,
  ])
  const siblings = (siblingsResult?.data ?? []) as PostSibling[]
  const versions = (dishVersionsResult?.data ?? []) as DishVersionRow[]
  const versionsTotal = versions[0]?.total_count ?? 0
  const galleryCount = recipe.gallery_count ?? 0

  const ingredientGroups = groupBySection(parseIngredients(recipe.ingredients))
  const steps = parseSteps(recipe.steps)
  const glossary = findGlossaryTerms([recipe.title, ...ingredientGroups.flatMap((g) => g.items.map((i) => i.name)), ...steps])
  const stepImages = visibleStepImages(recipe.step_images, false)
  const site = siteUrl()
  const canonicalUrl = `${site}${recipePath(recipe.slug)}`

  return (
    <main className={RECIPE_MAIN}>
      <TrackView event="recipe_view" subject={recipe.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildRecipeJsonLd(recipe, site)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildRecipeBreadcrumbJsonLd(recipe, site)) }} />
      <PageContainer>
        <nav data-testid="lab-links">
          <Link href="/lab/index">Lab index</Link>
          {LAB_SLUGS.map((other) => (
            <Link key={other} href={`/lab/przepis/${other}`} className="ml-4">
              {other}
            </Link>
          ))}
        </nav>
        <div className={`${RECIPE_TOP_ROW} print:hidden`}>
          <RecipeListBar slug={recipe.slug} from={null} fallback={categoryContext} />
          <RecipeBreadcrumbs category={recipe.category} title={recipe.title} className="hidden lg:ml-auto lg:block" />
        </div>
        <RecipeHeader
          recipe={recipe}
          versionsBar={
            versionsTotal > 0 ? (
              <DishVersionsBar
                count={versionsTotal}
                thumbs={versions.flatMap((v) => (v.image_url ? [v.image_url] : [])).slice(0, 3)}
                examples={versions.flatMap((v) => (v.variant_note ? [v.variant_note] : [])).slice(0, 3)}
              />
            ) : undefined
          }
          actions={
            <RecipeActions
              recipeId={recipe.id}
              recipeSlug={recipe.slug}
              isFavorite={false}
              isAuthenticated={false}
              title={recipe.title}
              shareUrl={canonicalUrl}
              steps={steps}
              stepImages={stepImages}
            />
          }
        />
        <RecipeChecklists
          recipeId={recipe.id}
          recipeSlug={recipe.slug}
          recipeTitle={recipe.title}
          ingredientGroups={ingredientGroups}
          steps={steps}
          stepImages={stepImages}
          servings={recipe.servings}
          glossary={glossary}
        >
          {galleryCount > 1 && (
            <div className="print:hidden">
              <LockedGallery count={galleryCount} loginHref={loginPath(recipePath(recipe.slug))} />
            </div>
          )}
        </RecipeChecklists>
        <div className="print:hidden">
          <RecipeListNav slug={recipe.slug} from={null} fallback={categoryContext} />
          {recipe.source_url && (
            <PostSiblings
              sourceUrl={recipe.source_url}
              sourceName={formatSource(recipe.source_type, recipe.source_url, recipe.source_author).text}
              siblings={siblings}
            />
          )}
          <DishVersions
            versions={versions}
            totalCount={versionsTotal}
            dish={recipe.dish ?? null}
            favoriteIds={null}
            order={parseVersionsSort(undefined)}
            current={{
              servings: recipe.servings,
              prep_time_minutes: recipe.prep_time_minutes,
              cook_time_minutes: recipe.cook_time_minutes,
              total_time_minutes: recipe.total_time_minutes,
              times_estimated: recipe.times_estimated,
              ingredients: recipe.ingredients,
            }}
          />
          <SimilarRecipes recipe={recipe} userId={null} anon />
        </div>
      </PageContainer>
    </main>
  )
}
