import Link from 'next/link'
import { categoryLabel } from '@/lib/recipe-categories'
import { requirePermission } from '@/lib/staff/context'
import {
  FEATURE_EVENTS,
  FEATURE_LABELS,
  formatCount,
  formatDay,
  isEmptySummary,
  loadUsageSummary,
  USAGE_WINDOWS,
  type UsageSummary,
} from '@/lib/staff/usage'
import { DailyBars, ShareBar } from '../charts'
import { PageTitle } from '../ui'

function Window({ summary }: { summary: UsageSummary }) {
  const empty = isEmptySummary(summary)
  const topCategory = summary.categories[0]?.views ?? 0
  const topRecipe = summary.recipes[0]?.views ?? 0
  return (
    <section aria-labelledby={`okno-${summary.days}`} className="mb-10">
      <h2 id={`okno-${summary.days}`} className="mb-1 text-xl font-bold">
        Ostatnie {summary.days} dni
      </h2>
      <p className="mb-4 text-ink-soft">od {formatDay(summary.since)}</p>
      {!empty && (
        <a
          href={`/admin/statystyki/csv?dni=${summary.days}`}
          download
          className="mb-4 inline-flex min-h-12 items-center underline underline-offset-4"
        >
          Pobierz CSV (ostatnie {summary.days} dni)
        </a>
      )}

      {empty ? (
        <p>Brak danych w tym okresie.</p>
      ) : (
        <>
          <div className="grid gap-x-8 lg:grid-cols-2">
            <DailyBars title="Odsłony przepisów dziennie" data={summary.daily.recipeViews} unit="odsłon" />
            <DailyBars title="Odsłony kategorii dziennie" data={summary.daily.categoryViews} unit="odsłon" />
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold">Kategorie</h3>
              {summary.categories.length === 0 ? (
                <p>Brak odsłon kategorii.</p>
              ) : (
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Najczęściej oglądane kategorie, ostatnie {summary.days} dni</caption>
                  <thead>
                    <tr className="border-b-2 border-border-card-2">
                      <th scope="col" className="py-2 pr-4">Kategoria</th>
                      <th scope="col" className="py-2 pr-4 text-right">Odsłony</th>
                      <th scope="col" className="py-2 text-right">Przepisów</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.categories.map((c) => (
                      <tr key={c.subject} className="border-b border-border-card">
                        <td className="py-2 pr-4">
                          {categoryLabel(c.subject)}
                          <ShareBar value={c.views} max={topCategory} />
                        </td>
                        <td className="py-2 pr-4 text-right">{formatCount(c.views)}</td>
                        <td className="py-2 text-right">{formatCount(c.recipes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Funkcje</h3>
              <table className="mb-8 w-full border-collapse text-left">
                <caption className="sr-only">Użycie funkcji, ostatnie {summary.days} dni</caption>
                <thead>
                  <tr className="border-b-2 border-border-card-2">
                    <th scope="col" className="py-2 pr-4">Funkcja</th>
                    <th scope="col" className="py-2 text-right">Razy</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_EVENTS.map((e) => (
                    <tr key={e} className="border-b border-border-card">
                      <td className="py-2 pr-4">{FEATURE_LABELS[e]}</td>
                      <td className="py-2 text-right">{formatCount(summary.features[e])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="mb-2 font-semibold">Najczęściej oglądane przepisy</h3>
              {summary.recipes.length === 0 ? (
                <p>Brak odsłon przepisów.</p>
              ) : (
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Najczęściej oglądane przepisy, ostatnie {summary.days} dni</caption>
                  <thead>
                    <tr className="border-b-2 border-border-card-2">
                      <th scope="col" className="py-2 pr-4">Przepis</th>
                      <th scope="col" className="py-2 text-right">Odsłony</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recipes.map((r) => (
                      <tr key={r.slug} className="border-b border-border-card">
                        <td className="py-2 pr-4 break-words">
                          <Link href={`/przepis/${r.slug}`} className="underline underline-offset-4">
                            {r.title}
                          </Link>
                          <ShareBar value={r.views} max={topRecipe} />
                        </td>
                        <td className="py-2 text-right">{formatCount(r.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {summary.orphanViews > 0 && (
                <p className="mt-3 text-ink-soft">
                  Odsłony przepisów, których już nie ma pod tym adresem (zmieniona nazwa, ukryte, usunięte):{' '}
                  {formatCount(summary.orphanViews)}.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default async function UsageStatsPage() {
  const staff = await requirePermission('analytics.read')
  const summaries = await Promise.all(USAGE_WINDOWS.map((days) => loadUsageSummary(staff.supabase, days)))

  return (
    <>
      <PageTitle>Statystyki</PageTitle>
      <p className="mb-8 max-w-prose text-ink-soft">
        To anonimowe liczniki odsłon, a nie liczba unikalnych odwiedzających: nie zapisujemy, kto ani skąd. Dane zbieramy
        dopiero po włączeniu zbierania, więc wcześniejsze dni są puste.
      </p>

      {summaries.map((summary, i) =>
        summary ? (
          <Window key={USAGE_WINDOWS[i]} summary={summary} />
        ) : (
          <p key={USAGE_WINDOWS[i]} role="alert" className="mb-6 rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
            Nie udało się wczytać statystyk z ostatnich {USAGE_WINDOWS[i]} dni. Odśwież stronę.
          </p>
        ),
      )}
    </>
  )
}
