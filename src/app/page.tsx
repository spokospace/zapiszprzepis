import type { Metadata } from 'next'
import { SessionHeader } from '@/app/components/session-header'
import { HomeContent } from '@/app/components/home/home-content'
import { RecipeRow } from '@/app/components/home/recipe-row'
import { HomeSearch } from '@/app/components/home/home-search'
import { PopularSearches } from '@/app/components/home/popular-searches'
import { CategoryGrid } from '@/app/components/home/category-grid'
import { GuestCta } from '@/app/components/home/guest-cta'
import { RecipeOfTheDay } from '@/app/components/home/recipe-of-the-day'
import { HOME_ROW_LIMIT } from '@/lib/member-home'
import { getRecentPublicRecipes, getRecipeOfTheDay } from '@/lib/recipe-cache'
import type { MyRecipeCard } from '@/lib/my-recipes'
import { getSiteUrl } from '@/lib/site-url'
import { homeMetadata, homeWebSiteJsonLd } from '@/lib/home-meta'
import { serializeJsonLd } from '@/lib/recipe-json-ld'

/**
 * Open Graph + Twitter card for the homepage, so a shared `/` link renders a
 * rich preview like every other route (#472). The absolute og:image is built
 * from the request origin via `getSiteUrl()` because the root layout sets no
 * `metadataBase`; title/description reuse the root metadata (home-meta.ts).
 */
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  return homeMetadata(siteUrl)
}

// Without this the build makes the page static with a 1 h timer, and nothing here refreshes
// it: open-next.config.ts has no queue, so „Przepis dnia” could stay stale until a deploy.
export const dynamic = 'force-dynamic'

/**
 * Public since E01-S02. The page reads neither the session nor the URL, so it is the same
 * for everyone; `HomeContent` adds what is personal in the browser.
 */
export default async function HomePage() {
  // "Ostatnio dodane" and "Przepis dnia" are decorative aids: a read error must
  // not take down the whole home, so each degrades to empty/none for this render.
  // The throw inside the cached read still prevents a failure being cached (#445).
  const [recentRecipes, recipeOfDay, siteUrl] = await Promise.all([
    getRecentPublicRecipes(HOME_ROW_LIMIT).catch(() => [] as MyRecipeCard[]),
    getRecipeOfTheDay(new Date()).catch(() => null),
    getSiteUrl(),
  ])

  return (
    <>
      {/* schema.org/WebSite: where Google reads the site name it shows above a result. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeWebSiteJsonLd(siteUrl)) }} />
      <SessionHeader />
      <main className="min-h-screen bg-white pb-10">
        <HomeContent
          search={
            <>
              <HomeSearch
                id="home-search"
                attached
                tone="action"
                label="Wpisz nazwę dania lub składnik"
                strongLabel
                placeholder="np. sernik, zupa z dyni, kurczak"
              />
              <PopularSearches />
            </>
          }
          recipeOfDay={
            recipeOfDay && (
              <RecipeOfTheDay
                slug={recipeOfDay.slug}
                title={recipeOfDay.title}
                imageUrl={recipeOfDay.image_url}
                description={recipeOfDay.description}
                sourceType={recipeOfDay.source_type}
                sourceUrl={recipeOfDay.source_url}
                sourceAuthor={recipeOfDay.source_author}
              />
            )
          }
          // Categories sit above the rows (handoff 17 prototype); in the desktop header's bar (§2), so tiles are phones only (§5e).
          categories={<CategoryGrid columns={3} className="lg:hidden" />}
          guestRows={
            <>
              {recentRecipes.length > 0 && (
                <RecipeRow id="recent-heading" heading="Ostatnio dodane" listKey="home" href="/" recipes={recentRecipes} />
              )}
              <GuestCta />
            </>
          }
        />
      </main>
    </>
  )
}
