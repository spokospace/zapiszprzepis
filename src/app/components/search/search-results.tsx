import Link from 'next/link'
import { buttonClasses } from '@/app/components/ui/button'
import { RecipeCard } from '@/app/components/recipe-card'
import { RecipeListSnapshot } from '@/app/components/recipe-list-snapshot'
import { CardFavoriteBar } from '@/app/components/search/card-favorite-bar'
import { favoriteReturnPath, loginPath } from '@/lib/login-redirect'
import { searchPath, type SearchScope } from '@/lib/routes'
import { recipeTotalMinutes } from '@/lib/recipe-meta'
import { SEARCH_MAX_PAGES, SEARCH_PAGE_SIZE, type SearchResult } from '@/lib/search'

interface SearchResultsProps {
  q: string
  scope: SearchScope
  page: number
  rows: SearchResult[]
  total: number
  /** Ids among `rows` the signed-in user has in Ulubione; null for a guest. */
  favoriteIds: Set<number> | null
}

/**
 * The result list of /szukaj (E01-S05): row cards with a favorites bar, then
 * „Pokaż kolejne 14” — a plain link that re-renders with one more page and
 * jumps to the first new card (no infinite scroll).
 */
export function SearchResults({ q, scope, page, rows, total, favoriteIds }: SearchResultsProps) {
  const remaining = total - rows.length
  const canShowMore = remaining > 0 && page < SEARCH_MAX_PAGES
  return (
    <>
      <RecipeListSnapshot
        listKey="szukaj"
        label="Wyniki wyszukiwania"
        href={searchPath(q, scope, page)}
        items={rows.map((r) => ({ slug: r.slug, title: r.title }))}
      />
      <ol className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li
            key={r.id}
            id={`wynik-${i + 1}`}
            // scroll-mt clears the sticky header (~73 px) when "Pokaż kolejne" jumps here.
            className="scroll-mt-28 overflow-hidden rounded-card border border-border-card bg-white"
          >
            <RecipeCard
              variant="row"
              from="szukaj"
              slug={r.slug}
              title={r.title}
              imageUrl={r.image_url}
              category={r.category}
              minutes={recipeTotalMinutes(r)}
              sourceType={r.source_type}
              sourceUrl={r.source_url}
              sourceAuthor={r.source_author}
            />
            <CardFavoriteBar
              recipeId={r.id}
              title={r.title}
              initialFavorited={favoriteIds?.has(r.id) ?? false}
              loginHref={favoriteIds ? null : loginPath(favoriteReturnPath(r.slug))}
            />
          </li>
        ))}
      </ol>
      {canShowMore && (
        <Link
          href={`${searchPath(q, scope, page + 1)}#wynik-${rows.length + 1}`}
          className={`${buttonClasses('outline', 'lg')} mt-4 w-full`}
        >
          Pokaż kolejne {Math.min(SEARCH_PAGE_SIZE, remaining)}
        </Link>
      )}
    </>
  )
}
