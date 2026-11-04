import Link from 'next/link'
import { requirePermission } from '@/lib/staff/context'
import { formatCount, formatDay } from '@/lib/staff/usage'
import {
  formatCtr,
  formatPosition,
  loadSearchSummary,
  SEARCH_WINDOWS,
  type SearchRow,
  type SearchSummary,
} from '@/lib/staff/search'
import { DailyBars } from '../charts'
import { PageTitle } from '../ui'

function MetricCells({ row }: { row: SearchRow }) {
  return (
    <>
      <td className="py-2 pr-4 text-right">{formatCount(row.clicks)}</td>
      <td className="py-2 pr-4 text-right">{formatCount(row.impressions)}</td>
      <td className="py-2 pr-4 text-right">{formatCtr(row)}</td>
      <td className="py-2 text-right">{formatPosition(row)}</td>
    </>
  )
}

function MetricHeaders() {
  return (
    <>
      <th scope="col" className="py-2 pr-4 text-right">Kliknięcia</th>
      <th scope="col" className="py-2 pr-4 text-right">Wyświetlenia</th>
      <th scope="col" className="py-2 pr-4 text-right">CTR</th>
      <th scope="col" className="py-2 text-right">Pozycja</th>
    </>
  )
}

function Window({ summary }: { summary: SearchSummary }) {
  const empty = summary.queries.length === 0 && summary.pages.length === 0
  return (
    <section aria-labelledby={`okno-${summary.days}`} className="mb-10">
      <h2 id={`okno-${summary.days}`} className="mb-1 text-xl font-bold">
        Ostatnie {summary.days} dni
      </h2>
      <p className="mb-4 text-ink-soft">od {formatDay(summary.since)}</p>

      {empty ? (
        <p>Brak danych w tym okresie.</p>
      ) : (
        <>
          <div className="grid gap-x-8 lg:grid-cols-2">
            <DailyBars title="Kliknięcia z Google dziennie" data={summary.daily.clicks} unit="kliknięć" />
            <DailyBars title="Wyświetlenia w Google dziennie" data={summary.daily.impressions} unit="wyświetleń" />
          </div>
          <div className="grid gap-8 xl:grid-cols-2">
            <div className="overflow-x-auto">
              <h3 className="mb-2 font-semibold">Zapytania</h3>
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Najczęstsze zapytania w Google, ostatnie {summary.days} dni</caption>
                <thead>
                  <tr className="border-b-2 border-border-card-2">
                    <th scope="col" className="py-2 pr-4">Zapytanie</th>
                    <MetricHeaders />
                  </tr>
                </thead>
                <tbody>
                  {summary.queries.map((q) => (
                    <tr key={q.query} className="border-b border-border-card">
                      <td className="py-2 pr-4 break-words">{q.query}</td>
                      <MetricCells row={q} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <h3 className="mb-2 font-semibold">Strony</h3>
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Strony z największym ruchem z Google, ostatnie {summary.days} dni</caption>
                <thead>
                  <tr className="border-b-2 border-border-card-2">
                    <th scope="col" className="py-2 pr-4">Strona</th>
                    <MetricHeaders />
                  </tr>
                </thead>
                <tbody>
                  {summary.pages.map((p) => (
                    <tr key={p.path} className="border-b border-border-card">
                      <td className="py-2 pr-4 break-words">
                        <Link href={p.path} className="underline underline-offset-4">
                          {p.title ?? p.path}
                        </Link>
                      </td>
                      <MetricCells row={p} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default async function SearchConsolePage() {
  const staff = await requirePermission('analytics.read')
  const summaries = await Promise.all(SEARCH_WINDOWS.map((days) => loadSearchSummary(staff.supabase, days)))
  const lastDay = summaries.find((s) => s?.lastDay)?.lastDay ?? null
  const loadFailed = summaries.some((s) => s === null)
  let synced = 'Dane nie zostały jeszcze pobrane.'
  if (lastDay) synced = `Ostatni pobrany dzień: ${formatDay(lastDay)}.`
  else if (loadFailed) synced = 'Nie udało się sprawdzić, kiedy dane zostały pobrane.'

  return (
    <>
      <PageTitle>Wyszukiwania Google</PageTitle>
      <p className="mb-8 max-w-prose text-ink-soft">
        Dane z Google Search Console, pobierane raz dziennie. Google podaje je z opóźnieniem około 2–3 dni i pomija rzadkie
        zapytania. Sumy powstają z 500 najpopularniejszych zapytań i stron każdego dnia, więc przy bardzo dużym ruchu są
        przybliżone. {synced}
      </p>

      {summaries.map((summary, i) =>
        summary ? (
          <Window key={SEARCH_WINDOWS[i]} summary={summary} />
        ) : (
          <p key={SEARCH_WINDOWS[i]} role="alert" className="mb-6 rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
            Nie udało się wczytać danych z ostatnich {SEARCH_WINDOWS[i]} dni. Odśwież stronę.
          </p>
        ),
      )}
    </>
  )
}
