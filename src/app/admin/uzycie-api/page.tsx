import { requirePermission } from '@/lib/staff/context'
import { formatCount } from '@/lib/staff/usage'
import {
  API_USAGE_WINDOWS,
  formatUsd,
  loadApiUsage,
  type ApiServiceUsage,
  type ApiUsageSummary,
} from '@/lib/staff/api-usage'
import { DailyBars } from '../charts'
import { PageTitle } from '../ui'

const SERVICE_LABEL: Record<ApiServiceUsage['service'], string> = {
  openai: 'OpenAI',
  firecrawl: 'Firecrawl',
  jina: 'Jina Reader',
}

function Service({ usage, days }: { usage: ApiServiceUsage; days: number }) {
  const label = SERVICE_LABEL[usage.service]
  const billedPerToken = usage.service === 'openai'
  const rows = usage.models.length > 1 ? [...usage.models, { ...usage, model: 'Razem' }] : usage.models
  return (
    <section aria-labelledby={`usluga-${days}-${usage.service}`} className="mb-8">
      <h3 id={`usluga-${days}-${usage.service}`} className="mb-2 text-lg font-semibold">{label}</h3>
      {usage.calls === 0 ? (
        <p>Brak wywołań w tym okresie.</p>
      ) : (
        <>
          <div className="grid gap-x-8 lg:grid-cols-2">
            <DailyBars title={`${label}: wywołania dziennie`} data={usage.dailyCalls} unit="wywołań" />
            {billedPerToken && <DailyBars title={`${label}: tokeny dziennie`} data={usage.dailyTokens} unit="tokenów" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">{label}: sumy za ostatnie {days} dni</caption>
              <thead>
                <tr className="border-b-2 border-border-card-2">
                  <th scope="col" className="py-2 pr-4">Model</th>
                  <th scope="col" className="py-2 pr-4 text-right">Wywołania</th>
                  <th scope="col" className="py-2 pr-4 text-right">Błędy</th>
                  {billedPerToken && (
                    <>
                      <th scope="col" className="py-2 pr-4 text-right">Tokeny wejścia</th>
                      <th scope="col" className="py-2 pr-4 text-right">Tokeny wyjścia</th>
                      <th scope="col" className="py-2 text-right">Koszt (szac.)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.model} className="border-b border-border-card">
                    <td className="py-2 pr-4 break-words">{m.model || '–'}</td>
                    <td className="py-2 pr-4 text-right">{formatCount(m.calls)}</td>
                    <td className="py-2 pr-4 text-right">{formatCount(m.failures)}</td>
                    {billedPerToken && (
                      <>
                        <td className="py-2 pr-4 text-right">{formatCount(m.tokensIn)}</td>
                        <td className="py-2 pr-4 text-right">{formatCount(m.tokensOut)}</td>
                        <td className="py-2 text-right">{formatUsd(m.costUsd)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function Window({ summary }: { summary: ApiUsageSummary }) {
  return (
    <section aria-labelledby={`okno-${summary.days}`} className="mb-10">
      <h2 id={`okno-${summary.days}`} className="mb-4 text-xl font-bold">Ostatnie {summary.days} dni</h2>
      {summary.services.map((s) => (
        <Service key={s.service} usage={s} days={summary.days} />
      ))}
    </section>
  )
}

export default async function ApiUsagePage() {
  const staff = await requirePermission('analytics.read')
  const summaries = await Promise.all(API_USAGE_WINDOWS.map((days) => loadApiUsage(staff.supabase, days)))

  return (
    <>
      <PageTitle>Zużycie API</PageTitle>
      <p className="mb-8 max-w-prose text-ink-soft">
        Własny licznik wywołań zewnętrznych usług przy dodawaniu przepisów. Koszt OpenAI to szacunek z liczby tokenów i
        cennika zapisanego w aplikacji, nie faktura. Dni liczone według czasu warszawskiego; licznik zbiera dane dopiero od
        wdrożenia, więc starsze wywołania nie są widoczne. Pozostałych limitów u dostawców jeszcze tu nie ma.
      </p>

      {summaries.map((summary, i) =>
        summary ? (
          <Window key={API_USAGE_WINDOWS[i]} summary={summary} />
        ) : (
          <p key={API_USAGE_WINDOWS[i]} role="alert" className="mb-6 rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
            Nie udało się wczytać danych z ostatnich {API_USAGE_WINDOWS[i]} dni. Odśwież stronę.
          </p>
        ),
      )}
    </>
  )
}
