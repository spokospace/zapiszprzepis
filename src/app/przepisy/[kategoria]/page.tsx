import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFavoriteIds } from '@/lib/favorites'
import { CATEGORY_ICONS, categoryLabel, isRecipeCategory } from '@/lib/recipe-categories'
import { getCategoryDescription } from '@/lib/category-descriptions'
import { categoryNoun, parsePageParam, parseTagParam, tagFacets, tagSummary } from '@/lib/category-tags'
import { tagLabel } from '@/lib/recipe-tags'
import { categoryPath } from '@/lib/routes'
import { getSiteUrl } from '@/lib/site-url'
import { PageContainer } from '@/app/components/page-container'
import { LIST_CARDS_CLASS, RecipeCard } from '@/app/components/recipe-card'
import { RecipeListSnapshot } from '@/app/components/recipe-list-snapshot'
import { recipesNoun } from '@/app/components/app-menu-model'
import { buttonClasses } from '@/app/components/ui/button'
import { TagFilter, type TagChip } from './_components/tag-filter'

type Params = Promise<{ kategoria: string }>
type SearchParams = Promise<{ tag?: string | string[]; strona?: string | string[] }>

/** Newest first, this many more per "Pokaż kolejne". */
const PAGE_SIZE = 24
/** `?strona=` cap: the list is read from the top, and PostgREST answers at most 1000 rows. */
const MAX_PAGE = Math.floor(1000 / PAGE_SIZE)

const LINK = 'font-semibold text-action-text underline underline-offset-4 hover:text-action-hover'

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { kategoria: category } = await params
  if (!isRecipeCategory(category)) return {}
  const siteUrl = await getSiteUrl()
  const canonical = `${siteUrl}${categoryPath(category)}`
  const label = categoryLabel(category)
  const description = await getCategoryDescription(category)
  // The PWA icon is the only site-level image; a per-category card is a follow-up.
  const ogImage = `${siteUrl}/icons/icon-512x512.png`
  return {
    title: `${label} · Zapisz Przepis`,
    description,
    // Tag/page variants must not compete with the bare category URL.
    // The .md alternate (#363) advertises the AI-citable Markdown listing.
    alternates: { canonical, types: { 'text/markdown': `${canonical}.md` } },
    openGraph: { title: label, description, type: 'website', images: [ogImage] },
    twitter: { card: 'summary', title: label, description },
  }
}

/**
 * Every recipe in one category, for guests too (E01-S09), with tag chips
 * (`?tag=a,b`, AND logic) and an aria-live summary (E01-S16), as list cards
 * with "Pokaż kolejne N" (E01-S22, screen 6). Reads the guest-safe
 * public_recipes view: one light read of every recipe's tags for the counters
 * and the category total, one read of the cards shown. An unknown category is
 * a 404, an empty one an empty state.
 */
export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { kategoria: category } = await params
  if (!isRecipeCategory(category)) notFound()
  const query = await searchParams
  const selected = parseTagParam(query.tag)
  const page = Math.min(parsePageParam(query.strona), MAX_PAGE)
  const shown = page * PAGE_SIZE

  const supabase = await createSupabaseServerClient()
  let cards = supabase
    .from('public_recipes')
    .select(
      'id, slug, title, image_url, category, source_type, source_url, source_author, tags, total_time_minutes, prep_time_minutes, cook_time_minutes',
      { count: 'exact' },
    )
    .eq('category', category)
  if (selected.length > 0) cards = cards.contains('tags', selected)
  const [user, tagRows, { data: recipes, count, error }] = await Promise.all([
    getCurrentUser(),
    supabase.from('public_recipes').select('tags').eq('category', category),
    // "Pokaż kolejne" re-renders the list from the top, one page longer.
    cards
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(0, shown - 1),
  ])

  if (error) {
    // Let the route error boundary say so instead of a misleading empty state.
    throw new Error(`[przepisy] Query failed: ${error.message}`)
  }
  // The counters are an aid, not the content: without them the list still works.
  if (tagRows.error) console.error('[przepisy] Tag counts failed:', tagRows.error)

  const label = categoryLabel(category)
  const Icon = CATEGORY_ICONS[category]
  const total = count ?? 0
  const filtered = selected.length > 0
  // The whole category, from the tag read; the list count stands in when that failed and nothing is filtered.
  const categoryTotal = tagRows.error ? (filtered ? null : total) : (tagRows.data ?? []).length
  const clearHref = categoryPath(category)
  const pageHref = (p: number) => categoryPath(category, { tags: selected, page: p })

  const chips: TagChip[] = tagRows.error
    ? []
    : tagFacets(tagRows.data ?? [], selected).map((f) => ({
        ...f,
        href: categoryPath(category, {
          tags: f.selected ? selected.filter((t) => t !== f.value) : [...selected, f.value],
        }),
      }))

  const list = recipes ?? []
  const remaining = total - list.length

  // The favorites bar on each card (E01-S06); favorites are private, so only with a session.
  const favoriteIds = user ? await getFavoriteIds(supabase, user.id, list.map((r) => r.id)) : new Set<number>()

  return (
    <main className="min-h-screen bg-surface">
      <PageContainer className="flex flex-col gap-4 py-6 sm:py-12">
        <header className="flex items-center gap-3">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-pill bg-surface-accent text-action-text">
            <Icon aria-hidden="true" className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[28px] leading-[1.1] font-bold break-words text-ink">{label}</h1>
            {categoryTotal != null && (
              <p className="text-[16px] text-ink-soft">
                {categoryTotal} {recipesNoun(categoryTotal)} w kategorii
              </p>
            )}
          </div>
        </header>

        {chips.length > 0 && <TagFilter chips={chips} question={`Jakie ${categoryNoun(label)}?`} />}

        {(filtered || list.length > 0) && (
          <div
            className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-tile px-4 py-3 ${filtered ? 'bg-surface-accent' : 'bg-surface-3'}`}
          >
            <p role="status" aria-live="polite" className="min-w-0 text-[18px] leading-snug wrap-anywhere text-ink">
              {filtered ? tagSummary(total, selected) : `Wszystkie: ${total} ${recipesNoun(total)}`}
            </p>
            {filtered && (
              <Link href={clearHref} scroll={false} className={buttonClasses('outline', 'md')}>
                <span aria-hidden="true">×&nbsp;</span>Wyczyść
              </Link>
            )}
          </div>
        )}

        {list.length === 0 ? (
          <p className="max-w-prose text-[18px] text-ink-soft">
            {filtered ? (
              <>
                Brak przepisów z tymi tagami. Odznacz jeden z tagów albo{' '}
                <Link href={clearHref} className={LINK}>
                  pokaż wszystkie przepisy: {label}
                </Link>
                .
              </>
            ) : (
              <>
                W tej kategorii nie ma jeszcze przepisów.{' '}
                <Link href="/" className={LINK}>
                  Wróć na stronę główną
                </Link>
              </>
            )}
          </p>
        ) : (
          <>
            <RecipeListSnapshot
              listKey="kategoria"
              label={filtered ? `${label}: ${selected.map(tagLabel).join(', ')}` : label}
              href={pageHref(page)}
              items={list.map((r) => ({ slug: r.slug, title: r.title }))}
            />
            <ol className={LIST_CARDS_CLASS}>
              {list.map((r, i) => (
                // scroll-mt clears the sticky header when "Pokaż kolejne" jumps here.
                <li key={r.id} id={`wynik-${i + 1}`} className="scroll-mt-28">
                  <RecipeCard
                    slug={r.slug}
                    title={r.title}
                    imageUrl={r.image_url}
                    category={r.category}
                    sourceType={r.source_type}
                    sourceUrl={r.source_url}
                    sourceAuthor={r.source_author}
                    from="kategoria"
                    favorite={{ recipeId: r.id, favorited: favoriteIds.has(r.id), isAuthenticated: Boolean(user) }}
                  />
                </li>
              ))}
            </ol>
          </>
        )}

        {remaining > 0 && page < MAX_PAGE && list.length > 0 && (
          <Link
            href={`${pageHref(page + 1)}#wynik-${list.length + 1}`}
            className={`${buttonClasses('outline', 'lg')} w-full`}
          >
            Pokaż kolejne {Math.min(PAGE_SIZE, remaining)}
          </Link>
        )}
      </PageContainer>
    </main>
  )
}
