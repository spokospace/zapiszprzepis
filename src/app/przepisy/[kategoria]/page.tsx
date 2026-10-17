import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFavoriteIds } from '@/lib/favorites'
import { categoryLabel, isRecipeCategory } from '@/lib/recipe-categories'
import { parsePageParam, parseTagParam, tagFacets } from '@/lib/category-tags'
import { tagLabel } from '@/lib/recipe-tags'
import { categoryPath } from '@/lib/routes'
import { getSiteUrl } from '@/lib/site-url'
import { PageContainer } from '@/app/components/page-container'
import { RecipeCard } from '@/app/components/recipe-card'
import { RecipeListSnapshot } from '@/app/components/recipe-list-snapshot'
import { recipesNoun } from '@/app/components/app-menu-model'
import { TagFilter, type TagChip } from './_components/tag-filter'

type Params = Promise<{ kategoria: string }>
type SearchParams = Promise<{ tag?: string | string[]; strona?: string | string[] }>

/** Newest first, one page at a time. */
const PAGE_SIZE = 48

const LINK = 'inline-flex min-h-[48px] items-center font-bold text-action-text underline underline-offset-4 hover:text-action-hover'

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { kategoria: category } = await params
  if (!isRecipeCategory(category)) return {}
  return {
    title: `${categoryLabel(category)} · ZapiszPrzepis`,
    // Tag/page variants must not compete with the bare category URL.
    alternates: { canonical: `${await getSiteUrl()}${categoryPath(category)}` },
  }
}

/**
 * Every recipe in one category, for guests too (E01-S09), with tag chips
 * (`?tag=a,b`, AND logic), an aria-live summary and paging (E01-S16). Reads the
 * guest-safe public_recipes view: one light read of every recipe's tags for the
 * counters, one page of cards. An unknown category is a 404, an empty one an
 * empty state.
 */
export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { kategoria: category } = await params
  if (!isRecipeCategory(category)) notFound()
  const query = await searchParams
  const selected = parseTagParam(query.tag)
  const page = parsePageParam(query.strona)

  const supabase = await createSupabaseServerClient()
  let cards = supabase
    .from('public_recipes')
    .select('id, slug, title, image_url, category, description, source_type, source_url, source_author', {
      count: 'exact',
    })
    .eq('category', category)
  if (selected.length > 0) cards = cards.contains('tags', selected)
  const [user, tagRows, { data: recipes, count, error }] = await Promise.all([
    getCurrentUser(),
    supabase.from('public_recipes').select('tags').eq('category', category),
    cards
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ])

  // PostgREST answers an offset past the end with 416 (PGRST103), not an empty
  // page: a stale or hand-edited ?strona= goes back to the first page.
  if (error?.code === 'PGRST103') redirect(categoryPath(category, { tags: selected }))
  if (error) {
    // Let the route error boundary say so instead of a misleading empty state.
    throw new Error(`[przepisy] Query failed: ${error.message}`)
  }
  // The counters are an aid, not the content: without them the grid still works.
  if (tagRows.error) console.error('[przepisy] Tag counts failed:', tagRows.error)

  const label = categoryLabel(category)
  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = selected.length > 0
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

  // The labelled heart on each card (E01-S06); favorites are private, so only with a session.
  const ids = (recipes ?? []).map((r) => r.id)
  const favoriteIds = user ? await getFavoriteIds(supabase, user.id, ids) : new Set<number>()

  return (
    <main className="min-h-screen bg-surface">
      <PageContainer className="py-6 sm:py-12">
        <h1 className="mb-6 text-2xl font-bold text-ink">{label}</h1>

        {chips.length > 0 && <TagFilter chips={chips} />}

        {(filtered || list.length > 0) && (
          <div className="mb-4 flex flex-wrap items-center gap-x-4">
            <p role="status" aria-live="polite" className="text-[18px] text-ink">
              <strong>
                {total} {recipesNoun(total)}
              </strong>
              {filtered && ` z tagami: ${selected.map(tagLabel).join(', ')}`}
            </p>
            {filtered && (
              <Link href={clearHref} scroll={false} className={LINK}>
                <span aria-hidden="true">×&nbsp;</span>Wyczyść
              </Link>
            )}
          </div>
        )}

        {list.length === 0 ? (
          <p className="max-w-prose text-[18px] text-ink-soft">
            {filtered ? (
              <>
                Brak przepisów z tymi tagami.{' '}
                <Link href={clearHref} className="font-semibold text-action-text underline underline-offset-4 hover:text-action-hover">
                  Pokaż wszystkie przepisy: {label}
                </Link>
              </>
            ) : (
              <>
                W tej kategorii nie ma jeszcze przepisów.{' '}
                <Link href="/" className="font-semibold text-action-text underline underline-offset-4 hover:text-action-hover">
                  Wróć na stronę główną
                </Link>
              </>
            )}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <RecipeListSnapshot
              listKey="kategoria"
              label={filtered ? `${label}: ${selected.map(tagLabel).join(', ')}` : label}
              href={pageHref(page)}
              items={list.map((r) => ({ slug: r.slug, title: r.title }))}
            />
            {list.map((r) => (
              <RecipeCard
                key={r.id}
                slug={r.slug}
                title={r.title}
                imageUrl={r.image_url}
                category={r.category}
                description={r.description}
                sourceType={r.source_type}
                sourceUrl={r.source_url}
                sourceAuthor={r.source_author}
                from="kategoria"
                favorite={{ recipeId: r.id, favorited: favoriteIds.has(r.id), isAuthenticated: Boolean(user) }}
              />
            ))}
          </div>
        )}

        {pages > 1 && list.length > 0 && (
          <nav aria-label="Strony" className="mt-8 flex flex-wrap items-center justify-between gap-3 text-[18px]">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={LINK}>
                ← Nowsze
              </Link>
            ) : (
              <span />
            )}
            <span className="text-ink-soft">
              Strona {page} z {pages}
            </span>
            {page < pages ? (
              <Link href={pageHref(page + 1)} className={LINK}>
                Starsze →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </PageContainer>
    </main>
  )
}
