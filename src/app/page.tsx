import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFailedShares, NO_FAILED_SHARES } from '@/lib/failed-shares'
import { homeGreeting } from '@/lib/home'
import { AppHeader } from '@/app/components/app-header'
import { AddRecipeForm } from '@/app/components/add-recipe-form'
import { RecipeCard } from '@/app/components/recipe-card'
import { PageContainer } from '@/app/components/page-container'
import { HomeSearch } from '@/app/components/home/home-search'
import { PopularSearches } from '@/app/components/home/popular-searches'
import { CategoryGrid } from '@/app/components/home/category-grid'
import { MemberTiles } from '@/app/components/home/member-tiles'
import { GuestCta } from '@/app/components/home/guest-cta'

type SearchParams = Promise<{ add_error?: string }>

/** Recent public recipes on the guest home: 4 fills the 2-column grid (E01-S04). */
const RECENT_LIMIT = 4

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { add_error } = await searchParams
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()

  // Public since E01-S02: a guest sees the home too; the signed-in home (C1) has no feed.
  const [failedShares, recentRecipes] = await Promise.all([
    user ? getFailedShares(supabase, user.id) : NO_FAILED_SHARES,
    user ? [] : getRecentPublicRecipes(supabase),
  ])

  return (
    <>
      <AppHeader failedShares={failedShares} isAuthenticated={Boolean(user)} />
      <main className="min-h-screen bg-white pb-10">
        {/* E01-S15 slot: the "N przepisów wymaga uwagi" notifications banner goes here. */}
        {user ? (
          <MemberHome addError={add_error} />
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
        <PageContainer className="py-6">
          <h1 id="hero-heading" className="mb-4 text-[30px] leading-tight font-bold text-ink">
            Czego dziś szukasz?
          </h1>
          <HomeSearch id="home-search-guest" />
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
            <div className="grid grid-cols-2 gap-3">
              {recentRecipes.map((r) => (
                <RecipeCard
                  // id, not slug: the feed spans users, and the id is the stable key.
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
          </section>
        )}
        <GuestCta />
      </PageContainer>
    </>
  )
}

function MemberHome({ addError }: { addError?: string }) {
  // Interim inputs until their stories land: E01-S12 supplies the vocative
  // (null → "Dzień dobry!"), E01-S11 the full-access flag (no add gate exists
  // before it, so every signed-in user has full access today).
  const vocative: string | null = null
  const hasFullAccess = true

  return (
    <PageContainer className="flex flex-col gap-8 pt-6">
      <div>
        <h1 className="mb-4 text-[30px] leading-tight font-bold text-ink">{homeGreeting(vocative)}</h1>
        <HomeSearch id="home-search-member" />
      </div>
      <MemberTiles hasFullAccess={hasFullAccess} />
      <CategoryGrid columns={2} />
      {/* E01-S10 slot: adding moves to /dodaj; until then the form lives here (?tab=add focuses it). */}
      <section aria-labelledby="add-heading">
        <h2 id="add-heading" className="mb-3 text-[22px] font-bold text-ink">
          Dodaj przepis z linku
        </h2>
        <AddRecipeForm addError={addError} />
      </section>
    </PageContainer>
  )
}
