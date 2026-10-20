import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { categoryLabel } from '@/lib/recipe-categories'
import { getFavoriteIds } from '@/lib/favorites'
import type { RecipeSource } from '@/lib/recipe-source'
import { getSiteUrl } from '@/lib/site-url'
import { profilePath } from '@/lib/routes'
import { avatarColorIndex, avatarUrl } from '@/lib/avatar'
import { SUPABASE_URL } from '@/lib/env'
import {
  MAX_PROFILE_PAGE,
  PROFILE_PAGE_SIZE,
  categoryCounts,
  isProfileOwner,
  isUsernameShape,
  memberSinceLabel,
  oldestCreatedAt,
  parseProfileCategory,
  parseProfilePage,
  profileCategoryHref,
  profileMoreHref,
  profileRobots,
} from '@/lib/public-profile'
import { parseGenderForm, profileCountLine, profileEmptyText } from '@/lib/gender-form'
import { PageContainer } from '@/app/components/page-container'
import { Avatar } from '@/app/components/ui/avatar'
import { LIST_CARDS_CLASS, RecipeCard } from '@/app/components/recipe-card'
import { buttonClasses } from '@/app/components/ui/button'
import { chipClasses } from '@/app/components/ui/chip'
import { recipesNoun } from '@/app/components/app-menu-model'

type Params = Promise<{ username: string }>
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

/** The route param, decoded once; a malformed escape stays as is and then fails isUsernameShape. */
function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** PostgREST's default max-rows; the summary is read in batches of this size. */
const SUMMARY_BATCH = 1000
/** Safety stop for the summary loop (10 requests). */
const SUMMARY_MAX_ROWS = 10_000

/**
 * The profile and a summary of every recipe the person owns (S03: "added as
 * the first person"), shared by generateMetadata and the page via cache().
 * Reads only anon-readable surfaces: profiles (S18), the public_recipes
 * view and profile_gender_form() (E01-S23: the grammatical form f/m/null for
 * "Dodała/Dodał", never the raw gender) — never profiles_private, favorites or
 * auth. Null = no such profile.
 */
const loadProfile = cache(async (username: string) => {
  if (!isUsernameShape(username)) return null
  const supabase = await createSupabaseServerClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, created_at, avatar_path, avatar_color')
    .eq('username', username)
    .maybeSingle()
  if (error) throw new Error(`[profile] Profile query failed: ${error.message}`)
  if (!profile) return null

  // The grammatical form for "Dodała/Dodał", read alongside the summary. Before the
  // E01-S23 migration the function is missing: the error just means neutral wording.
  // Promise.resolve starts the (lazy) builder now instead of at the await.
  const formPromise = Promise.resolve(supabase.rpc('profile_gender_form', { p_username: username }))

  // All of this person's recipes, two columns only: the total, the chip counts
  // and the oldest date. PostgREST caps one response at 1000 rows and the
  // biggest profile already has hundreds, so read it in pages.
  const rows: { category: string | null; created_at: string }[] = []
  for (let from = 0; from < SUMMARY_MAX_ROWS; from += SUMMARY_BATCH) {
    const { data: batch, error: summaryError } = await supabase
      .from('public_recipes')
      .select('category, created_at')
      .eq('author_username', username)
      .order('id', { ascending: true })
      .range(from, from + SUMMARY_BATCH - 1)
    if (summaryError) throw new Error(`[profile] Summary query failed: ${summaryError.message}`)
    rows.push(...(batch ?? []))
    if (!batch || batch.length < SUMMARY_BATCH) break
  }
  const { data: form } = await formPromise
  return {
    profile,
    total: rows.length,
    categories: categoryCounts(rows),
    oldest: oldestCreatedAt(rows),
    genderForm: parseGenderForm(form),
  }
})

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params
  const data = await loadProfile(decodeParam(username))
  if (!data) return {}
  const name = data.profile.display_name
  return {
    title: `${name} · Zapisz Przepis`,
    description: `Przepisy dodane przez ${name} w aplikacji Zapisz Przepis.`,
    // Absolute (no metadataBase in the root layout); filters and paging are not separate documents.
    alternates: { canonical: `${await getSiteUrl()}${profilePath(data.profile.username)}` },
    robots: profileRobots(data.total),
  }
}

/**
 * Public profile /u/{username} (E01-S14, screen 7): avatar, name, recipe count,
 * "W aplikacji Zapisz Przepis od …", category chips and the recipes this person added,
 * 12 more per "Pokaż kolejne". Same for guests and signed-in visitors, except
 * the owner also gets a link to /settings. Nothing private is shown.
 */
export default async function ProfilePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { username: rawUsername } = await params
  const username = decodeParam(rawUsername)
  // Auth is independent of the profile reads; start it now instead of after them.
  const userPromise = getCurrentUser()
  const data = await loadProfile(username)
  if (!data) notFound()

  const { profile, total, categories, oldest, genderForm } = data
  const query = await searchParams
  const category = parseProfileCategory(query.kategoria, categories)
  const page = parseProfilePage(query.strona)
  const listCount = category ? (categories.find((c) => c.value === category)?.count ?? 0) : total
  const shown = page * PROFILE_PAGE_SIZE
  const user = await userPromise
  const isOwner = isProfileOwner(user?.id, profile.id)

  let recipes: {
    id: number
    slug: string
    title: string
    image_url: string | null
    category: string
    source_type: RecipeSource
    source_url: string | null
    source_author: string | null
    total_time_minutes: number | null
    prep_time_minutes: number | null
    cook_time_minutes: number | null
  }[] = []
  const supabase = await createSupabaseServerClient()
  if (total > 0) {
    let listQuery = supabase
      .from('public_recipes')
      .select(
        'id, slug, title, image_url, category, source_type, source_url, source_author, total_time_minutes, prep_time_minutes, cook_time_minutes',
      )
      .eq('author_username', username)
    if (category) listQuery = listQuery.eq('category', category)
    // One row past the page tells us whether "Pokaż kolejne" is needed.
    const { data: list, error } = await listQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(0, shown)
    if (error) throw new Error(`[profile] Recipe query failed: ${error.message}`)
    recipes = list ?? []
  }
  // At the page cap a further link would render the same list again.
  const hasMore = recipes.length > shown && page < MAX_PROFILE_PAGE
  const visible = recipes.slice(0, shown)
  // The favorites bar on each card (E01-S22); favorites are private, so only with a session.
  const favoriteIds = user && visible.length ? await getFavoriteIds(supabase, user.id, visible.map((r) => r.id)) : new Set<number>()
  // The first card of the newest page, where "Pokaż kolejne" lands (#wiecej).
  const firstNewIndex = page > 1 ? (page - 1) * PROFILE_PAGE_SIZE : -1

  return (
    <main className="min-h-screen bg-surface">
      <PageContainer className="py-6 sm:py-12">
        {isOwner && (
          <section
            aria-label="Twój profil"
            className="mb-6 rounded-card bg-surface-3 p-4"
          >
            <p className="mb-3 text-[19px] text-ink">Tak widzą Twój profil inni.</p>
            <Link href="/settings" className={`${buttonClasses('outline', 'lg')} w-full sm:w-auto`}>
              Zmień nazwę lub obrazek
            </Link>
          </section>
        )}

        <header className="mb-6 flex items-center gap-4">
          {/* The uploaded photo, else the letter on the chosen (or id-derived) colour — same as /settings (S13). */}
          <Avatar
            src={avatarUrl(SUPABASE_URL, profile.avatar_path)}
            name={profile.display_name}
            colorIndex={avatarColorIndex(profile.id, profile.avatar_color)}
            size={88}
          />
          <div className="min-w-0">
            <h1 className="break-words text-[28px] font-bold leading-tight text-ink">{profile.display_name}</h1>
            {total > 0 && <p className="text-[17px] text-ink">{profileCountLine(genderForm, total)}</p>}
            <p className="text-[17px] text-ink-soft">W aplikacji Zapisz Przepis od {memberSinceLabel(profile.created_at, oldest)}</p>
          </div>
        </header>

        {total === 0 ? (
          <p className="max-w-prose text-[19px] text-ink-soft">
            {profileEmptyText(genderForm, profile.display_name)}{' '}
            <Link href="/" className="font-semibold text-action-text underline underline-offset-4 hover:text-action-hover">
              Wróć na stronę główną
            </Link>
          </p>
        ) : (
          <>
            {categories.length > 1 && (
              <nav aria-labelledby="profile-categories-h" className="mb-6">
                <h2 id="profile-categories-h" className="mb-2 text-[19px] font-bold text-ink">
                  Przepisy według kategorii
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {[{ value: null, label: 'Wszystkie', count: total }, ...categories].map((c) => {
                    const active = c.value === category
                    return (
                      <li key={c.value ?? 'all'}>
                        <Link
                          href={profileCategoryHref(profile.username, c.value)}
                          aria-current={active ? 'page' : undefined}
                          className={chipClasses(active)}
                        >
                          <span>
                            {active ? '✓ ' : ''}
                            {c.label}
                          </span>
                          <span className="text-[16px] font-normal opacity-80">{c.count}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            )}

            {/* Screen 7: "Ostatnio dodane: N przepisów" over the list; a picked category names itself with its count. */}
            <h2 className="mb-3 text-[19px] font-bold text-ink">
              {category ? categoryLabel(category) : 'Ostatnio dodane'}: {listCount} {recipesNoun(listCount)}
            </h2>
            <ol className={LIST_CARDS_CLASS}>
              {visible.map((r, i) => (
                // #wiecej: the first card of the newest page, where "Pokaż kolejne" lands.
                <li key={r.id} id={i === firstNewIndex ? 'wiecej' : undefined} className="scroll-mt-24">
                  <RecipeCard
                    slug={r.slug}
                    title={r.title}
                    imageUrl={r.image_url}
                    category={r.category}
                    sourceType={r.source_type}
                    sourceUrl={r.source_url}
                    sourceAuthor={r.source_author}
                    favorite={{ recipeId: r.id, favorited: favoriteIds.has(r.id), isAuthenticated: Boolean(user) }}
                  />
                </li>
              ))}
            </ol>

            {hasMore && (
              <Link
                href={profileMoreHref(profile.username, category, page + 1)}
                className={`${buttonClasses('outline', 'lg')} mt-6 w-full`}
              >
                Pokaż kolejne
              </Link>
            )}
          </>
        )}
      </PageContainer>
    </main>
  )
}
