import Link from 'next/link'
import { requirePermission } from '@/lib/staff/context'
import { readFlash } from '@/lib/staff/flash'
import {
  listDeletedRecipes,
  listRecipes,
  parseRecipeFilter,
  parseRecipesCursor,
  RECIPE_FILTER_LABELS,
  RECIPE_FILTERS,
} from '@/lib/staff/recipes'
import { categoryLabel } from '@/lib/recipe-categories'
import { Banner, buttonClass, buttonOutlineClass, fieldClass, formatWhen, PageTitle } from '../ui'
import { restoreRecipe } from './actions'

const OK_MESSAGES = { deleted: 'Przepis został usunięty. Znajdziesz go niżej, na liście usuniętych.' } as const

type SearchParams = { q?: string; filter?: string; after?: string; afterId?: string; ok?: string; error?: string }

export default async function RecipesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requirePermission('recipes.read')
  const params = await searchParams
  const query = params.q?.trim().slice(0, 100) ?? ''
  const filter = parseRecipeFilter(params.filter)
  const [page, deleted] = await Promise.all([
    listRecipes(staff.supabase, { query, filter, after: parseRecipesCursor(params.after, params.afterId) }),
    listDeletedRecipes(staff.supabase),
  ])
  const canRestore = staff.permissions.has('recipes.delete')

  const nextHref = page?.next
    ? `/admin/przepisy?${new URLSearchParams({
        ...(query ? { q: query } : {}),
        ...(filter !== 'all' ? { filter } : {}),
        after: page.next.createdAt,
        afterId: String(page.next.id),
      }).toString()}`
    : null

  return (
    <>
      <PageTitle>Przepisy</PageTitle>
      <Banner flash={readFlash(params, OK_MESSAGES)} />

      <form action="/admin/przepisy" method="get" role="search" className="mb-6 flex flex-wrap gap-3">
        <label htmlFor="q" className="sr-only">
          Szukaj przepisu
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Tytuł, adres, źródło, autor lub numer"
          maxLength={100}
          className={`${fieldClass} max-w-md flex-1`}
        />
        <label htmlFor="filter" className="sr-only">
          Które przepisy
        </label>
        <select id="filter" name="filter" defaultValue={filter} className={`${fieldClass} w-auto`}>
          {RECIPE_FILTERS.map((f) => (
            <option key={f} value={f}>
              {RECIPE_FILTER_LABELS[f]}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass}>
          Szukaj
        </button>
      </form>

      {!page ? (
        <p role="alert" className="rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
          Nie udało się wczytać listy. Odśwież stronę.
        </p>
      ) : page.recipes.length === 0 ? (
        <p>Brak wyników.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <caption className="sr-only">Przepisy, od najnowszych</caption>
            <thead>
              <tr className="border-b-2 border-border-card-2">
                <th scope="col" className="py-2 pr-4">Przepis</th>
                <th scope="col" className="py-2 pr-4">Autor</th>
                <th scope="col" className="py-2 pr-4">Kategoria</th>
                <th scope="col" className="py-2 pr-4">Dodany</th>
                <th scope="col" className="py-2 pr-4 text-right">Ulubione</th>
                <th scope="col" className="py-2">Stan</th>
              </tr>
            </thead>
            <tbody>
              {page.recipes.map((r) => (
                <tr key={r.id} className="border-b border-border-card">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/przepisy/${r.id}`}
                      className="min-h-touch inline-flex items-center font-semibold underline underline-offset-4"
                    >
                      {r.title || r.slug}
                    </Link>
                    <span className="block break-all text-ink-soft">#{r.id} · {r.slug}</span>
                  </td>
                  <td className="py-2 pr-4">{r.ownerUsername ? `@${r.ownerUsername}` : '—'}</td>
                  <td className="py-2 pr-4">{categoryLabel(r.category)}</td>
                  <td className="py-2 pr-4">{formatWhen(r.createdAt)}</td>
                  <td className="py-2 pr-4 text-right">{r.favoriteCount}</td>
                  <td className="py-2">{r.hiddenAt ? <strong className="text-danger">Ukryty</strong> : 'Widoczny'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextHref && (
        <p className="mt-6">
          <Link href={nextHref} className="min-h-touch inline-flex items-center underline underline-offset-4">
            Starsze przepisy
          </Link>
        </p>
      )}

      {deleted && deleted.length > 0 && (
        <section aria-labelledby="deleted-heading" className="mt-12">
          <h2 id="deleted-heading" className="mb-2 text-xl font-semibold">
            Usunięte przez zespół
          </h2>
          <p className="mb-4 max-w-prose text-ink-soft">
            Przywrócenie oddaje przepisowi numer i adres. Ulubione, które zniknęły razem z nim, nie wracają.
          </p>
          <ul className="flex flex-col gap-3">
            {deleted.map((d) => (
              <li key={d.recipeId} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-card pb-3">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{d.title || d.slug}</span>
                  <span className="block break-all text-ink-soft">
                    #{d.recipeId} · {d.slug} · usunięty {formatWhen(d.deletedAt)}
                    {d.redirectToSlug ? ` · przekierowanie do ${d.redirectToSlug}` : ''}
                  </span>
                </span>
                {canRestore && (
                  <form action={restoreRecipe}>
                    <input type="hidden" name="id" value={d.recipeId} />
                    <button type="submit" className={buttonOutlineClass}>
                      Przywróć
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
