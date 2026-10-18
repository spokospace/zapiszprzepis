import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFailedShares, NO_FAILED_SHARES, type FailedSharesResult } from '@/lib/failed-shares'
import { getMenuSummary } from '@/lib/menu-summary'
import { homeGreeting } from '@/lib/home'
import { getGreetingName } from '@/lib/first-name'
import { vocative } from '@/lib/vocative'
import { AppHeader } from '@/app/components/app-header'
import { CAROUSEL_CLASS, CAROUSEL_ITEM_CLASS, CAROUSEL_SIZES, RecipeCard } from '@/app/components/recipe-card'
import { RecipeListSnapshot } from '@/app/components/recipe-list-snapshot'
import { PageContainer } from '@/app/components/page-container'
import { HomeSearch } from '@/app/components/home/home-search'
import { PopularSearches } from '@/app/components/home/popular-searches'
import { CategoryGrid } from '@/app/components/home/category-grid'
import { MemberTiles } from '@/app/components/home/member-tiles'
import { GuestCta } from '@/app/components/home/guest-cta'
import { AttentionBanner } from '@/app/components/home/attention-banner'
import { FavoriteAddedNotice } from '@/app/components/favorite-button'
import { parseRecipeId } from '@/lib/favorites'
import { ADD_RECIPE_PATH } from '@/lib/routes'

type SearchParams = Promise<{ fav_added?: string; tab?: string }>

/** Recent public recipes on the guest home: 4 fills the 2-column grid (E01-S04). */
const RECENT_LIMIT = 4

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { fav_added, tab } = await searchParams
  // The add form left the home for /dodaj (E01-S10); old `/?tab=add` links follow it.
  if (tab === 'add') redirect(ADD_RECIPE_PATH)
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()

  // Public since E01-S02: a guest sees the home too; the signed-in home (C1) has no feed.
  // The menu summary (E01-S09) also carries the E01-S11 full-access flag, which
  // decides the "Moje przepisy" tile and the locked "Dodaj przepis" one.
  const [failedShares, menu, recentRecipes, greetingName] = await Promise.all([
    user ? getFailedShares(supabase, user.id) : NO_FAILED_SHARES,
    getMenuSummary(supabase, user),
    user ? [] : getRecentPublicRecipes(supabase),
    user ? getGreetingName(supabase, user.id) : null,
  ])

  return (
    <>
      <AppHeader failedShares={failedShares} isAuthenticated={Boolean(user)} menu={menu} />
      <main className="min-h-screen bg-white pb-10">
        {user ? (
          <MemberHome
            failedShares={failedShares}
            hasFullAccess={menu?.hasFullAccess ?? false}
            vocative={vocative(greetingName)}
            favoriteAdded={parseRecipeId(fav_added)}
          />
        ) : (
          <GuestHome recentRecipes={recentRecipes} />
        )}
      </main>
    </>
  )
}

/**
 * "Ostatnio dodane": the public feed across all users, read through the
 * guest-safe public_recipes view (recipes itself is owner-only).
 */
async function getRecentPublicRecipes(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data } = await supabase
    .from('public_recipes')
    .select('id, slug, title, image_url, category, description, source_type, source_url, source_author')
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT)
  return data ?? []
}

type RecentRecipe = Awaited<ReturnType<typeof getRecentPublicRecipes>>[number]

function GuestHome({ recentRecipes }: { recentRecipes: RecentRecipe[] }) {
  return (
    <>
      <section aria-labelledby="hero-heading" className="bg-surface-accent">
        {/* Desktop (E01-S17, A8): a centred hero with a 46 px H1 and the 760 px field. */}
        <PageContainer className="py-6 lg:py-14 lg:text-center">
          <h1 id="hero-heading" className="text-[28px] leading-[1.15] font-bold text-ink lg:text-[46px] lg:leading-[1.1]">
            Czego dziś szukasz?
          </h1>
          <p className="mt-3 mb-4 text-[18px] leading-normal text-ink-soft lg:mb-6 lg:text-[19px]">
            Przepisy z Facebooka, YouTube i blogów, spisane po polsku i zapisane na stałe.
          </p>
          <HomeSearch id="home-search-guest" centered tone="action" placeholder="Danie lub składnik, np. dynia" />
        </PageContainer>
      </section>
      <PageContainer className="flex flex-col gap-8 pt-6">
        <PopularSearches />
        <CategoryGrid columns={3} />
        {recentRecipes.length > 0 && (
          <section aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="mb-3 text-[22px] font-bold text-ink">
              Ostatnio dodane
            </h2>
            {/* E01-S07: lets the recipe page show "← Ostatnio dodane" + prev/next. */}
            <RecipeListSnapshot
              listKey="home"
              label="Ostatnio dodane"
              href="/"
              items={recentRecipes.map((r) => ({ slug: r.slug, title: r.title }))}
            />
            <ul className={CAROUSEL_CLASS}>
              {recentRecipes.map((r) => (
                // id, not slug: the feed spans users, and the id is the stable key.
                <li key={r.id} className={CAROUSEL_ITEM_CLASS}>
                  <RecipeCard
                    from="home"
                    slug={r.slug}
                    title={r.title}
                    imageUrl={r.image_url}
                    category={r.category}
                    description={r.description}
                    sourceType={r.source_type}
                    sourceUrl={r.source_url}
                    sourceAuthor={r.source_author}
                    sizes={CAROUSEL_SIZES}
                    favorite={{ recipeId: r.id, favorited: false, isAuthenticated: false }}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        <GuestCta />
      </PageContainer>
    </>
  )
}

function MemberHome({
  failedShares,
  hasFullAccess,
  vocative,
  favoriteAdded,
}: {
  /** The header's result, reused for the E01-S15 banner (no extra query). */
  failedShares: FailedSharesResult
  hasFullAccess: boolean
  /** "Aniu" from the S13 first name (else the display name) via the S12 rule; null → "Dzień dobry!". */
  vocative: string | null
  /** A guest-home card heart's login round-trip ends here (E01-S06); this page has no heart to show its toast. */
  favoriteAdded: number | null
}) {
  return (
    <PageContainer className="flex flex-col gap-8 pt-6">
      <div>
        <h1 className="mb-[18px] text-[28px] leading-tight font-bold text-ink">{homeGreeting(vocative)}</h1>
        {/* E01-S15 (handoff C1): "N przepisów wymaga uwagi" sits under the greeting. */}
        <AttentionBanner failedShares={failedShares} className="mb-4" />
        <HomeSearch id="home-search-member" label="Czego szukasz?" strongLabel placeholder="np. zupa z dyni" submitLabel="Szukaj" />
      </div>
      {favoriteAdded !== null && <FavoriteAddedNotice recipeId={favoriteAdded} />}
      <MemberTiles hasFullAccess={hasFullAccess} />
      <CategoryGrid columns={2} />
    </PageContainer>
  )
}
