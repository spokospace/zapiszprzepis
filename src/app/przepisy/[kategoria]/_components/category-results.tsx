'use client'

import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import { CATEGORY_PAGE_SIZE, clampPage, tagCounts, withTags, type CategoryCard } from '@/lib/category-list'
import { categoryNoun, parsePageParam, parseTagParam, tagFacetsFromCounts, tagSummary } from '@/lib/category-tags'
import { tagLabel } from '@/lib/recipe-tags'
import { categoryPath, recipePath } from '@/lib/routes'
import { LIST_CARDS_CLASS, RecipeCard } from '@/app/components/recipe-card'
import { RecipeListSnapshot } from '@/app/components/recipe-list-snapshot'
import { recipesNoun } from '@/app/components/app-menu-model'
import { buttonClasses } from '@/app/components/ui/button'
import { isModifiedClick } from '@/app/components/modified-click'
import { pushLocation, useHydrated, useLocationSearch } from '@/app/components/use-location-search'
import { TagFilter, type TagChip } from './tag-filter'

const LINK = 'font-semibold text-action-text underline underline-offset-4 hover:text-action-hover'

/**
 * The tag chips, the summary and the cards of a category (#739). The page holds every
 * card of the category, so `?tag=` (AND) and `?strona=` are applied here, in the
 * browser: one saved file answers every variant of the address, and nothing asks the
 * server. Before hydration (and for crawlers without JS) it renders the bare list.
 */
export function CategoryResults({ category, label, cards }: { category: string; label: string; cards: CategoryCard[] }) {
  const search = useLocationSearch()
  const hydrated = useHydrated()
  const params = new URLSearchParams(search)
  const selected = parseTagParam(params.getAll('tag'))
  const filtered = selected.length > 0
  // A category holds a few hundred cards at most: filtering them on each render is cheap.
  const matching = withTags(cards, selected)
  const total = matching.length
  const counts = tagCounts(matching, [])
  const page = clampPage(parsePageParam(params.get('strona') ?? undefined), total)
  const list = matching.slice(0, page * CATEGORY_PAGE_SIZE)
  const remaining = total - list.length

  const clearHref = categoryPath(category)
  const pageHref = (p: number) => categoryPath(category, { tags: selected, page: p })
  const chips: TagChip[] = tagFacetsFromCounts(counts, selected).map((f) => ({
    ...f,
    href: categoryPath(category, { tags: f.selected ? selected.filter((t) => t !== f.value) : [...selected, f.value] }),
  }))

  // "Pokaż kolejne" moves focus-free to the first new card, like the old #wynik-N anchor.
  const scrollTo = useRef<string | null>(null)
  useEffect(() => {
    if (!scrollTo.current) return
    document.getElementById(scrollTo.current)?.scrollIntoView()
    scrollTo.current = null
  }, [list.length])

  function go(event: MouseEvent<HTMLAnchorElement>, href: string, anchor?: string) {
    if (isModifiedClick(event)) return
    event.preventDefault()
    scrollTo.current = anchor ?? null
    pushLocation(href)
  }

  return (
    <>
      {chips.length > 0 && (
        <TagFilter chips={chips} question={`Jakie ${categoryNoun(label)}?`} onNavigate={pushLocation} />
      )}

      <div className="flex flex-col gap-4">
        {(filtered || list.length > 0) && (
          <div
            className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-tile px-4 py-3 ${filtered ? 'bg-surface-accent' : 'bg-surface-3'}`}
          >
            <p role="status" aria-live="polite" className="min-w-0 text-[18px] leading-snug wrap-anywhere text-ink">
              {filtered ? tagSummary(total, selected) : `Wszystkie: ${total} ${recipesNoun(total)}`}
            </p>
            {filtered && (
              <a href={clearHref} onClick={(event) => go(event, clearHref)} className={buttonClasses('outline', 'md')}>
                <span aria-hidden="true">×&nbsp;</span>Wyczyść
              </a>
            )}
          </div>
        )}

        {list.length === 0 ? (
          <p className="max-w-prose text-[18px] text-ink-soft">
            {filtered ? (
              <>
                Brak przepisów z tymi tagami. Odznacz jeden z tagów albo{' '}
                <a href={clearHref} onClick={(event) => go(event, clearHref)} className={LINK}>
                  pokaż wszystkie przepisy: {label}
                </a>
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
                    favorite={{ recipeId: r.id }}
                  />
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      {/* Without JS the file always shows page 1, so ?strona= would loop: list the rest as plain links. */}
      {remaining > 0 && !hydrated && (
        <noscript>
          <h2 className="text-[19px] font-bold text-ink">Pozostałe przepisy: {label}</h2>
          <ul className="flex flex-col gap-2 text-[18px]">
            {matching.slice(list.length).map((r) => (
              <li key={r.id}>
                <a href={recipePath(r.slug)} className={LINK}>
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </noscript>
      )}

      {remaining > 0 && hydrated && (
        <a
          href={`${pageHref(page + 1)}#wynik-${list.length + 1}`}
          onClick={(event) => go(event, pageHref(page + 1), `wynik-${list.length + 1}`)}
          className={`${buttonClasses('outline', 'lg')} w-full`}
        >
          Pokaż kolejne {Math.min(CATEGORY_PAGE_SIZE, remaining)}
        </a>
      )}
    </>
  )
}
