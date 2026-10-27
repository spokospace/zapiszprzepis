import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFailedShares, NO_FAILED_SHARES } from '@/lib/failed-shares'
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
import { RecipeOfTheDay } from '@/app/components/home/recipe-of-the-day'
import { FavoriteAddedNotice } from '@/app/components/favorite-button'
import { parseRecipeId } from '@/lib/favorites'
import { getRecentPublicRecipes, getRecipeOfTheDay } from '@/lib/recipe-cache'
import { MY_RECIPE_CARD_COLUMNS, type MyRecipeCard } from '@/lib/my-recipes'
import { ADD_RECIPE_PATH } from '@/lib/routes'
import type { ListKey } from '@/lib/recipe-list-context'
import type { Metadata } from 'next'
import { getSiteUrl } from '@/lib/site-url'
import { homeMetadata } from '@/lib/home-meta'

type SearchParams = Promise<{ fav_added?: string; tab?: string }>

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
    // "Ostatnio dodane" and "Przepis dnia" are decorative aids: a read error must
    // not take down the whole home, so each degrades to empty/none for this render.
    // The throw inside the cached read still prevents a failure being cached (#445).
    user ? [] : getRecentPublicRecipes(RECENT_LIMIT).catch(() => [] as MyRecipeCard[]),
    user ? getGreetingName(supabase, user.id) : null,
    user ? menuPromise.then((m) => getMemberRows(supabase, user.id, m?.hasFullAccess ?? false)) : null,
    getRecipeOfTheDay(new Date()).catch(() => null),
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
 * The hero both homes share (handoff 14): one column with searching as the only task.
 * From md it is centered (H1 up to 64 px, field block at most 780 px); on a phone it is
 * left-aligned (handoff 14, 3c/3d: padding 28/16/24, gap 14, H1 36 px). „Przepis dnia” is no longer in here — it is its
 * own block under a rule, rendered by the page after the hero.
 */
function Hero({ id, title, subtitle, children }: { id: string; title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="bg-white">
      <PageContainer className="flex flex-col items-start gap-3.5 pt-7 pb-6 md:items-center md:gap-[18px] md:pt-16 md:pb-[52px] md:text-center">
        {/* max-w-full: under items-start a flex child is as wide as its longest word;
            at a large system font (or a long run-together word) that word outgrew a phone
            and widened the page (#448). The subtitle needs the same cap as the heading. */}
        <h1
          id={id}
          className="max-w-full text-[36px] leading-[1.05] font-extrabold text-ink md:text-[48px] lg:text-[64px] lg:leading-[1.02]"
        >
          {title}
        </h1>
        <p className="max-w-full text-[19px] leading-normal text-ink-soft md:text-[20px] md:leading-[1.45]">{subtitle}</p>
        <div className="w-full max-w-[780px] text-left md:mt-3.5">{children}</div>
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
        subtitle={
          <>
            Przepisy z internetu w jednym miejscu.
            {/* Second sentence starts a new line on a phone only; from md the subtitle flows as one line. */}
            <br className="md:hidden" /> Zawsze pod ręką, kiedy gotujesz.
          </>
        }
      >
        <HomeSearch
          id="home-search-guest"
          attached
          tone="action"
          label="Wpisz nazwę dania lub składnik"
          strongLabel
          placeholder="np. sernik, zupa z dyni, kurczak"
        />
        <PopularSearches />
      </Hero>
      {recipeOfDay}
      <PageContainer className="flex flex-col gap-8 pt-6">
        {/* Categories sit above the rows (handoff 17 prototype); in the desktop header's bar (§2), so tiles are phones only (§5e). */}
        <CategoryGrid columns={3} className="lg:hidden" />
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
        <GuestCta />
      </PageContainer>
    </>
  )
}

function MemberHome({
  vocative,
  favoriteAdded,
  rows,
  myRecipesCount,
  favoritesCount,
  recipeOfDay,
}: {
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
      >
        <HomeSearch
          id="home-search-member"
          attached
          tone="action"
          label="Wpisz nazwę dania lub składnik"
          strongLabel
          placeholder="np. zupa z dyni"
        />
        <PopularSearches />
      </Hero>
      {recipeOfDay}
      <PageContainer className="flex flex-col gap-8 pt-6">
        {favoriteAdded !== null && !shown.has(favoriteAdded) && <FavoriteAddedNotice recipeId={favoriteAdded} />}
        {/* Categories sit above the rows (handoff 17 prototype); in the desktop header's bar (§2), so tiles are phones only (§5e). */}
        <CategoryGrid columns={3} className="lg:hidden" />
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
            {/* min-w-0 + break-words: the label shrinks and wraps instead of widening the
                flex row past the phone at a large font (WCAG 1.4.10). */}
            <span className="min-w-0 break-words">Dodaj pierwszy przepis</span>
          </Link>
        )}
      </PageContainer>
    </>
  )
}
