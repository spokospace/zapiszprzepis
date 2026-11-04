import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageContainer } from '@/app/components/page-container'
import { getPublicRecipeLongLived } from '@/lib/recipe-cache'
import { recipePath } from '@/lib/routes'
import { buildRecipeBreadcrumbJsonLd, buildRecipeJsonLd, serializeJsonLd } from '@/lib/recipe-json-ld'
import { parseIngredients, groupBySection } from '@/lib/ingredients'
import { parseSteps, visibleStepImages } from '@/lib/steps'
import { findGlossaryTerms } from '@/lib/ingredient-glossary'
import { RecipeHeader } from '@/app/przepis/[slug]/_components/recipe-header'
import { RecipeActions } from '@/app/przepis/[slug]/_components/recipe-actions'
import { RecipeChecklists } from '@/app/przepis/[slug]/_components/recipe-checklists'
import { RECIPE_MAIN } from '@/app/przepis/[slug]/_components/recipe-split'

/**
 * Temporary experiment (#701): the guest recipe page with no per-request input (no
 * cookies, headers, searchParams or session check; middleware skips `/lab/`), so Next can
 * serve it from the incremental cache for `revalidate` seconds. Does it survive the load
 * that makes `/przepis/{slug}` answer 1102? Off unless RECIPE_LAB=1, `noindex`, unlinked.
 * Remove the route, the flag and the middleware matcher entry once the probe has an answer.
 */
// Next reads segment config statically, so this repeats LONG_REVALIDATE_SECONDS as a literal;
// the test below pins the two together.
export const revalidate = 3600

// No slug is prerendered at build time; an empty list is what makes Next render a slug on
// its first visit and then serve it from the incremental cache (on-demand ISR), instead of
// treating the dynamic segment as a per-request render.
export function generateStaticParams() {
  return []
}

export const metadata: Metadata = {
  title: 'Recipe lab',
  robots: { index: false, follow: false },
}

export default async function RecipeLabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (process.env.RECIPE_LAB !== '1') notFound()
  const recipe = await getPublicRecipeLongLived(slug)
  if (!recipe) notFound()

  // Not getSiteUrl(): without NEXT_PUBLIC_SITE_URL it falls back to headers(), which would
  // quietly turn this route dynamic again.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://zapiszprzepis.pl').replace(/\/$/, '')
  const ingredientGroups = groupBySection(parseIngredients(recipe.ingredients))
  const steps = parseSteps(recipe.steps)
  const glossary = findGlossaryTerms([recipe.title, ...ingredientGroups.flatMap((g) => g.items.map((i) => i.name)), ...steps])
  const stepImages = visibleStepImages(recipe.step_images, false)
  const canonicalUrl = `${siteUrl}${recipePath(recipe.slug)}`

  return (
    <main className={RECIPE_MAIN}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildRecipeJsonLd(recipe, siteUrl)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildRecipeBreadcrumbJsonLd(recipe, siteUrl)) }} />
      <PageContainer>
        <RecipeHeader
          recipe={recipe}
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
        />
      </PageContainer>
    </main>
  )
}
