import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache, Fragment } from 'react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { categoryLabel } from '@/lib/recipe-categories'
import type { RecipeSource } from '@/lib/recipe-source'
import { getSiteUrl } from '@/lib/site-url'
import { profilePath } from '@/lib/routes'
import {
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
import { PageContainer } from '@/app/components/page-container'
import { ProfileAvatar } from '@/app/components/profile-avatar'
import { RecipeCard } from '@/app/components/recipe-card'
import { buttonClasses } from '@/app/components/ui/button'

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

const CHIP =
  'inline-flex min-h-[48px] items-center gap-2 rounded-pill border-2 px-4 text-[17px] font-bold leading-tight transition-colors'

/**
 * The profile and a summary of every recipe the person owns (S03: "added as
 * the first person"), shared by generateMetadata and the page via cache().
 * Reads only anon-readable surfaces: profiles (S18) and the public_recipes
 * view — never profiles_private, favorites or auth. Null = no such profile.
 */
const loadProfile = cache(async (username: string) => {
  if (!isUsernameShape(username)) return null
  const supabase = await createSupabaseServerClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, created_at')
    .eq('username', username)
    .maybeSingle()
  if (error) throw new Error(`[profile] Profile query failed: ${error.message}`)
  if (!profile) return null

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
  return { profile, total: rows.length, categories: categoryCounts(rows), oldest: oldestCreatedAt(rows) }
})

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params
  const data = await loadProfile(decodeParam(username))
  if (!data) return {}
  const name = data.profile.display_name
  return {
    title: `${name} · ZapiszPrzepis`,
    description: `Przepisy dodane przez ${name} w ZapiszPrzepis.`,
    // Absolute (no metadataBase in the root layout); filters and paging are not separate documents.
    alternates: { canonical: `${await getSiteUrl()}${profilePath(data.profile.username)}` },
    robots: profileRobots(data.total),
  }
}

/**
 * Public profile /u/{username} (E01-S14, screen 7): avatar, name, recipe count,
 * "W ZapiszPrzepis od …", category chips and the recipes this person added,
 * 12 more per "Pokaż kolejne". Same for guests and signed-in visitors, except
 * the owner also gets a link to /settings. Nothing private is shown.
 */
export default async function ProfilePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { username: rawUsername } = await params
  const username = decodeParam(rawUsername)
  const data = await loadProfile(username)
  if (!data) notFound()

  const { profile, total, categories, oldest } = data
  const query = await searchParams
  const category = parseProfileCategory(query.kategoria, categories)
  const page = parseProfilePage(query.strona)
  const shown = page * PROFILE_PAGE_SIZE
  const user = await getCurrentUser()
  const isOwner = isProfileOwner(user?.id, profile.id)

  let recipes: {
    id: number
    slug: string
    title: string
    image_url: string | null
    category: string
    description: string | null
    source_type: RecipeSource
    source_url: string | null
    source_author: string | null
  }[] = []
  if (total > 0) {
    const supabase = await createSupabaseServerClient()
    let listQuery = supabase
      .from('public_recipes')
      .select('id, slug, title, image_url, category, description, source_type, source_url, source_author')
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
  const hasMore = recipes.length > shown
  const visible = recipes.slice(0, shown)
  // The first card of the newest page, where "Pokaż kolejne" lands (#wiecej).
  const firstNewIndex = page > 1 ? (page - 1) * PROFILE_PAGE_SIZE : -1

  return (
    <main className="min-h-screen bg-surface">
      <PageContainer className="py-6 sm:py-12">
        {isOwner && (
          <section
            aria-label="Twój profil"
            className="mb-6 rounded-card border-2 border-border-accent bg-surface-accent p-4"
          >
            <p className="mb-3 text-[19px] text-ink">Tak widzą Twój profil inni.</p>
            <Link href="/settings" className={`${buttonClasses('outline', 'lg')} w-full sm:w-auto`}>
              Zmień nazwę lub obrazek
            </Link>
          </section>
        )}

        <header className="mb-6 flex items-center gap-4">
          <ProfileAvatar username={profile.username} displayName={profile.display_name} size={88} />
          <div className="min-w-0">
            <h1 className="break-words text-[30px] font-bold leading-tight text-ink">{profile.display_name}</h1>
            {total > 0 && <p className="text-[19px] text-ink">Dodane przepisy: {total}</p>}
            <p className="text-[17px] text-ink-soft">W ZapiszPrzepis od {memberSinceLabel(profile.created_at, oldest)}</p>
          </div>
        </header>

        {total === 0 ? (
          <p className="max-w-prose text-[19px] text-ink-soft">
            Na tym profilu nie ma jeszcze przepisów.{' '}
            <Link href="/" className="font-semibold text-action-text underline underline-offset-4 hover:text-action-hover">
              Wróć na stronę główną
            </Link>
          </p>
        ) : (
          <>
            {categories.length > 1 && (
              <nav aria-label="Kategorie przepisów" className="mb-6">
                <ul className="flex flex-wrap gap-2">
                  {[{ value: null, label: 'Wszystkie', count: total }, ...categories].map((c) => {
                    const active = c.value === category
                    return (
                      <li key={c.value ?? 'all'}>
                        <Link
                          href={profileCategoryHref(profile.username, c.value)}
                          aria-current={active ? 'page' : undefined}
                          className={`${CHIP} ${active ? 'border-ink bg-ink text-white' : 'border-border-card-2 bg-white text-ink hover:bg-surface-3'}`}
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

            <h2 className="mb-3 text-[22px] font-bold text-ink">{category ? categoryLabel(category) : 'Przepisy'}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visible.map((r, i) => (
                <Fragment key={r.id}>
                  {i === firstNewIndex && <span id="wiecej" className="col-span-full -mb-3 block scroll-mt-24" aria-hidden="true" />}
                  <RecipeCard
                    slug={r.slug}
                    title={r.title}
                    imageUrl={r.image_url}
                    category={r.category}
                    description={r.description}
                    sourceType={r.source_type}
                    sourceUrl={r.source_url}
                    sourceAuthor={r.source_author}
                  />
                </Fragment>
              ))}
            </div>

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
