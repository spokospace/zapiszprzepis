import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFailedShares, NO_FAILED_SHARES, type FailedSharesResult } from '@/lib/failed-shares'
import { getMenuSummary } from '@/lib/menu-summary'
import { homeGreeting } from '@/lib/home'
import { getGreetingName } from '@/lib/first-name'
import { vocative } from '@/lib/vocative'
import { AppHeader } from '@/app/components/app-header'
import { CAROUSEL_SIZES, RecipeCard } from '@/app/components/recipe-card'
import { CardCarousel } from '@/app/components/card-carousel'
import { RecipeListSnapshot } from '@/app/components/recipe-list-snapshot'
import { PageContainer } from '@/app/components/page-container'
import { HomeSearch } from '@/app/components/home/home-search'
import { PopularSearches } from '@/app/components/home/popular-searches'
import { CategoryGrid } from '@/app/components/home/category-grid'
import { GuestCta } from '@/app/components/home/guest-cta'
import { AttentionBanner } from '@/app/components/home/attention-banner'
import { RecipeOfTheDay } from '@/app/components/home/recipe-of-the-day'
import { FavoriteAddedNotice } from '@/app/components/favorite-button'
import { parseRecipeId } from '@/lib/favorites'
import { dailyRecipeIndex } from '@/lib/recipe-of-the-day'
import { MY_RECIPE_CARD_COLUMNS, type MyRecipeCard } from '@/lib/my-recipes'
import { ADD_RECIPE_PATH } from '@/lib/routes'
import type { ListKey } from '@/lib/recipe-list-context'

type SearchParams = Promise<{ fav_added?: string; tab?: string }>

/** Cards per home row: 4 fills the desktop row (E01-S31 §2, §5). */
const RECENT_LIMIT = 4

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

// A home row's card needs exactly the „Moje przepisy” card columns; `public_recipes`
// and `recipes` both return them, so the one `MyRecipeCard` / `MY_RECIPE_CARD_COLUMNS`
// (src/lib/my-recipes.ts) is reused here rather than a second copy.

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { fav_added, tab } = await searchParams
  // The add form left the home for /dodaj (E01-S10); old `/?tab=add` links follow it.
  if (tab === 'add') redirect(ADD_RECIPE_PATH)
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()

  // Public since E01-S02: a guest sees the home too. The menu summary (E01-S09) also
  // carries the E01-S11 full-access flag and the counters for the "Wszystkie … (n)" links.
  const menuPromise = getMenuSummary(supabase, user)
  const [failedShares, menu, recentRecipes, greetingName, memberRows, recipeOfDay] = await Promise.all([
    user ? getFailedShares(supabase, user.id) : NO_FAILED_SHARES,
    menuPromise,
    user ? [] : getRecentPublicRecipes(supabase),
    user ? getGreetingName(supabase, user.id) : null,
    user ? menuPromise.then((m) => getMemberRows(supabase, user.id, m?.hasFullAccess ?? false)) : null,
    getRecipeOfTheDay(supabase),
  ])

  const recipeOfDayCard = recipeOfDay ? (
    <RecipeOfTheDay
      slug={recipeOfDay.slug}
      title={recipeOfDay.title}
      imageUrl={recipeOfDay.image_url}
      description={recipeOfDay.description}
      sourceType={recipeOfDay.source_type}
      sourceUrl={recipeOfDay.source_url}
      sourceAuthor={recipeOfDay.source_author}
    />
  ) : null

  return (
    <>
      <AppHeader failedShares={failedShares} isAuthenticated={Boolean(user)} menu={menu} />
      <main className="min-h-screen bg-white pb-10">
        {user && memberRows ? (
          <MemberHome
            failedShares={failedShares}
            vocative={vocative(greetingName)}
            favoriteAdded={parseRecipeId(fav_added)}
            rows={memberRows}
            myRecipesCount={menu?.myRecipesCount ?? null}
            favoritesCount={menu?.favoritesCount ?? null}
            recipeOfDay={recipeOfDayCard}
          />
        ) : (
          <GuestHome recentRecipes={recentRecipes} recipeOfDay={recipeOfDayCard} />
        )}
      </main>
    </>
  )
}

/**
 * "Ostatnio dodane": the public feed across all users, read through the
 * guest-safe public_recipes view (recipes itself is owner-only).
 */
async function getRecentPublicRecipes(supabase: ServerClient): Promise<MyRecipeCard[]> {
  const { data } = await supabase
    .from('public_recipes')
    .select(MY_RECIPE_CARD_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT)
  return data ?? []
}

/** The pool „Przepis dnia” draws from: a bounded, stable set of photographed non-YouTube recipes. */
const RECIPE_OF_DAY_POOL = 90

/**
 * „Przepis dnia” (E01-S31 §5c): one recipe a day, the same for everyone. A bounded
 * pool of recent recipes that have a photo and are not YouTube, picked by the day of
 * the year (dailyRecipeIndex) — no „wylosuj inny”, no cron. Read through the guest-safe
 * public_recipes view so a guest sees it too.
 */
async function getRecipeOfTheDay(supabase: ServerClient): Promise<MyRecipeCard | null> {
  // Pick from a bounded pool of recent photographed non-YouTube recipes: read just
  // the ids (cheap), choose by the day, then fetch only that one card's columns —
  // not all 90 rows' descriptions on every home render.
  const { data: pool } = await supabase
    .from('public_recipes')
    .select('id')
    .not('image_url', 'is', null)
    .neq('source_type', 'youtube')
    .order('id', { ascending: false })
    .limit(RECIPE_OF_DAY_POOL)
  if (!pool || pool.length === 0) return null
  const pick = pool[dailyRecipeIndex(new Date(), pool.length)]
  const { data } = await supabase.from('public_recipes').select(MY_RECIPE_CARD_COLUMNS).eq('id', pick.id).maybeSingle()
  return data ?? null
}

/**
 * The signed-in home's rows (E01-S31 §5): the newest of the user's own recipes (full
 * access only) and of their favorites, plus which of the own ones are also favorites,
 * so every card's heart is right. Favorites are private (owner-only RLS); the recipe
 * of each is embedded from the guest-safe view, as on /ulubione (#231).
 */
async function getMemberRows(supabase: ServerClient, userId: string, hasFullAccess: boolean) {
  const [mine, favorites] = await Promise.all([
    hasFullAccess
      ? supabase
          .from('recipes')
          .select(MY_RECIPE_CARD_COLUMNS)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(RECENT_LIMIT)
      : null,
    supabase
      .from('favorites')
      .select(`recipe:public_recipes(${MY_RECIPE_CARD_COLUMNS})`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT)
      .returns<{ recipe: MyRecipeCard | null }[]>(),
  ])
  const mineRows: MyRecipeCard[] = mine?.data ?? []
  const favoriteRows = (favorites.data ?? []).map((f) => f.recipe).filter((r): r is MyRecipeCard => Boolean(r))

  // The own recipes that are not among the newest favorites may still be favorites.
  const favoriteIds = new Set(favoriteRows.map((r) => r.id))
  const unknown = mineRows.filter((r) => !favoriteIds.has(r.id)).map((r) => r.id)
  if (unknown.length > 0) {
    const { data } = await supabase.from('favorites').select('recipe_id').eq('user_id', userId).in('recipe_id', unknown)
    for (const row of data ?? []) favoriteIds.add(row.recipe_id)
  }
  return { mine: mineRows, favorites: favoriteRows, favoriteIds }
}

type MemberRows = Awaited<ReturnType<typeof getMemberRows>>

/**
 * The hero both homes share (E01-S31 §5a): `bg-surface-accent`, two columns from
 * ~832 px — the greeting (38 px H1), subtitle and the one search field on the left,
 * „Przepis dnia” on the right — collapsing to one column (search, then the photo full
 * width) on a phone. `auto-fit`/`minmax` does the collapse without a breakpoint.
 */
function Hero({
  id,
  title,
  subtitle,
  children,
  recipeOfDay,
}: {
  id: string
  title: string
  subtitle: string
  children: ReactNode
  recipeOfDay?: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="bg-white">
      <PageContainer className="py-6 lg:py-10">
        <div className="grid items-center gap-8 [grid-template-columns:repeat(auto-fit,minmax(min(100%,25rem),1fr))]">
          <div>
            <h1 id={id} className="text-[32px] leading-[1.15] font-extrabold text-ink lg:text-[50px] lg:leading-[1.1]">
              {title}
            </h1>
            <p className="mt-3 mb-4 text-[19px] leading-normal text-ink-soft lg:mb-5">{subtitle}</p>
            {children}
          </div>
          {recipeOfDay}
        </div>
      </PageContainer>
    </section>
  )
}

/**
 * A row of recipe cards under a heading (E01-S31 §2, §5): the swipeable strip on a
 * phone, one grid row from lg, with an optional "Wszystkie … →" link under it.
 * `favoriteIds` is the signed-in user's favorites among these cards; null for a guest,
 * whose heart sends them to log in first.
 */
function RecipeRow({
  id,
  heading,
  listKey,
  href,
  recipes,
  favoriteIds,
  more,
}: {
  id: string
  heading: string
  /** Lets the recipe page show "← {heading}" + prev/next (E01-S07). */
  listKey: ListKey
  /** Where that "←" goes back to. */
  href: string
  recipes: MyRecipeCard[]
  favoriteIds: Set<number> | null
  more?: { href: string; label: string }
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-4 border-t border-ink pt-5 text-[28px] font-bold text-ink">
        {heading}
      </h2>
      <RecipeListSnapshot
        listKey={listKey}
        label={heading}
        href={href}
        items={recipes.map((r) => ({ slug: r.slug, title: r.title }))}
      />
      <CardCarousel
        label={heading}
        items={recipes.map((r) => ({
          // id, not slug: a row can span users, and the id is the stable key.
          key: r.id,
          card: (
            <RecipeCard
              from={listKey}
              slug={r.slug}
              title={r.title}
              imageUrl={r.image_url}
              category={r.category}
              description={r.description}
              sourceType={r.source_type}
              sourceUrl={r.source_url}
              sourceAuthor={r.source_author}
              photo="carousel"
              sizes={CAROUSEL_SIZES}
              favorite={{ recipeId: r.id, favorited: favoriteIds?.has(r.id) ?? false, isAuthenticated: favoriteIds !== null }}
            />
          ),
        }))}
      />
      {more && (
        <Link
          href={more.href}
          className="mt-4 inline-flex min-h-12 items-center text-[18px] font-bold text-action-text underline underline-offset-4 hover:text-action-hover"
        >
          {more.label}
        </Link>
      )}
    </section>
  )
}

function GuestHome({ recentRecipes, recipeOfDay }: { recentRecipes: MyRecipeCard[]; recipeOfDay?: ReactNode }) {
  return (
    <>
      <Hero
        id="hero-heading"
        title="Czego dziś szukasz?"
        subtitle="Przepisy z internetu w jednym miejscu. Zawsze pod ręką, kiedy gotujesz."
        recipeOfDay={recipeOfDay}
      >
        <HomeSearch
          id="home-search-guest"
          attached
          tone="action"
          label="Wpisz nazwę dania lub składnik"
          strongLabel
          placeholder="np. sernik, zupa z dyni, kurczak"
        />
      </Hero>
      <PageContainer className="flex flex-col gap-8 pt-6">
        <PopularSearches />
        {recentRecipes.length > 0 && (
          <RecipeRow
            id="recent-heading"
            heading="Ostatnio dodane"
            listKey="home"
            href="/"
            recipes={recentRecipes}
            favoriteIds={null}
          />
        )}
        {/* Categories are in the desktop header's bar (§2); the tiles are for phones only (§5e). */}
        <CategoryGrid columns={3} className="lg:hidden" />
        <GuestCta />
      </PageContainer>
    </>
  )
}

function MemberHome({
  failedShares,
  vocative,
  favoriteAdded,
  rows,
  myRecipesCount,
  favoritesCount,
  recipeOfDay,
}: {
  /** The header's result, reused for the E01-S15 banner (no extra query). */
  failedShares: FailedSharesResult
  /** "Aniu" from the S13 first name (else the display name) via the S12 rule; null → "Czego dziś szukasz?". */
  vocative: string | null
  /** A guest-home card heart's login round-trip ends here (E01-S06); a row card shows the toast itself when it holds that recipe. */
  favoriteAdded: number | null
  rows: MemberRows
  myRecipesCount: number | null
  favoritesCount: number | null
  /** „Przepis dnia” in the hero's right column (§5a, §5c). */
  recipeOfDay?: ReactNode
}) {
  const { mine, favorites, favoriteIds } = rows
  const withCount = (label: string, count: number | null) => (count == null ? `${label} →` : `${label} (${count}) →`)
  const shown = new Set([...mine, ...favorites].map((r) => r.id))
  return (
    <>
      <Hero
        id="hero-heading"
        title={homeGreeting(vocative)}
        subtitle="Szukaj w swoich przepisach i ulubionych albo we wszystkich."
        recipeOfDay={recipeOfDay}
      >
        <HomeSearch
          id="home-search-member"
          attached
          tone="action"
          label="Wpisz nazwę dania lub składnik"
          strongLabel
          placeholder="np. zupa z dyni"
        />
        {/* E01-S15: "N przepisów wymaga uwagi" under the field; older users miss the badge alone. */}
        <AttentionBanner failedShares={failedShares} className="mt-4" />
      </Hero>
      <PageContainer className="flex flex-col gap-8 pt-6">
        {favoriteAdded !== null && !shown.has(favoriteAdded) && <FavoriteAddedNotice recipeId={favoriteAdded} />}
        {mine.length > 0 && (
          <RecipeRow
            id="mine-heading"
            heading="Ostatnio dodane przez Ciebie"
            listKey="moje"
            href="/recipes"
            recipes={mine}
            favoriteIds={favoriteIds}
            more={{ href: '/recipes', label: withCount('Wszystkie moje', myRecipesCount) }}
          />
        )}
        {favorites.length > 0 && (
          <RecipeRow
            id="favorites-heading"
            heading="Ulubione"
            listKey="fav"
            href="/ulubione"
            recipes={favorites}
            favoriteIds={favoriteIds}
            more={{ href: '/ulubione', label: withCount('Wszystkie ulubione', favoritesCount) }}
          />
        )}
        {mine.length === 0 && favorites.length === 0 && (
          // Nothing to show yet: one door to the first recipe (the add page; without full
          // access it shows the access-code gate, 3c).
          <Link
            href={ADD_RECIPE_PATH}
            className="flex min-h-16 items-center gap-3.5 rounded-tile border border-ink bg-white p-4 text-[20px] font-bold text-ink no-underline! hover:border-border-card-2 hover:bg-surface-2"
          >
            <Plus aria-hidden="true" className="h-7 w-7 shrink-0 text-action-text" />
            Dodaj pierwszy przepis
          </Link>
        )}
        {/* Categories are in the desktop header's bar (§2); the tiles are for phones only (§5e). */}
        <CategoryGrid columns={3} className="lg:hidden" />
      </PageContainer>
    </>
  )
}
