import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCategoryCards } from '@/lib/recipe-cache'
import { CATEGORY_ICONS, categoryLabel, isRecipeCategory } from '@/lib/recipe-categories'
import { getCategoryMeta } from '@/lib/category-descriptions'
import { categoryPath } from '@/lib/routes'
import { getSiteUrl } from '@/lib/site-url'
import { categoryOgImagePath } from '@/lib/category-og'
import { TrackView } from '@/app/components/track-view'
import { PageContainer } from '@/app/components/page-container'
import { recipesNoun } from '@/app/components/app-menu-model'
import { CategoryResults } from './_components/category-results'
import { OG_SITE, SITE_NAME } from '@/lib/site'

type Params = Promise<{ kategoria: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { kategoria: category } = await params
  if (!isRecipeCategory(category)) return {}
  const siteUrl = await getSiteUrl()
  const canonical = `${siteUrl}${categoryPath(category)}`
  const { title, description } = await getCategoryMeta(category)
  // A per-category 1200×630 social card (public/og/categories/<value>.jpg).
  const ogImage = `${siteUrl}${categoryOgImagePath(category)}`
  return {
    title: `${title} · ${SITE_NAME}`,
    description,
    // Tag/page variants must not compete with the bare category URL.
    // The .md alternate (#363) advertises the AI-citable Markdown listing.
    alternates: { canonical, types: { 'text/markdown': `${canonical}.md` } },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      ...OG_SITE,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${title} · ${SITE_NAME}` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

/**
 * Every recipe in one category, for guests too (E01-S09), with tag chips (`?tag=a,b`,
 * AND logic, E01-S16) and "Pokaż kolejne N" (E01-S22, screen 6). It reads no session and
 * no address on the server: every card of the category goes to the page, and
 * CategoryResults filters and pages them in the browser, so the build saves the page as
 * a file (scripts/export-recipe-files.mjs, #739). An unknown category is a 404, an empty
 * one an empty state; a failed read throws to the route error boundary.
 */
export default async function CategoryPage({ params }: { params: Params }) {
  const { kategoria: category } = await params
  if (!isRecipeCategory(category)) notFound()
  const cards = await getCategoryCards(category)
  if (cards.length >= 1000) console.error(`[przepisy] ${category}: 1000 cards, the read cap; older recipes are left out`)

  const label = categoryLabel(category)
  const Icon = CATEGORY_ICONS[category]

  return (
    // data-category-page: the export checks for it before it saves the file.
    <main className="min-h-screen bg-surface" data-category-page={category}>
      <TrackView event="category_view" subject={category} />
      <PageContainer className="flex flex-col gap-4 py-6 sm:py-12">
        <header className="flex items-center gap-3">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-pill bg-surface-accent text-action-text">
            <Icon aria-hidden="true" className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[28px] leading-[1.1] font-bold break-words text-ink">{label}</h1>
            <p className="text-[16px] text-ink-soft">
              {cards.length} {recipesNoun(cards.length)} w kategorii
            </p>
          </div>
        </header>

        <CategoryResults category={category} label={label} cards={cards} />
      </PageContainer>
    </main>
  )
}
