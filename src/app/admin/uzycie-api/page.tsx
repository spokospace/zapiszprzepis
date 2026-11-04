import { requirePermission } from '@/lib/staff/context'
import { formatCount } from '@/lib/staff/usage'
import {
  API_USAGE_WINDOWS,
  formatUsd,
  loadApiLimits,
  loadApiUsage,
  type ApiLimit,
  type ApiServiceUsage,
  type ApiUsageSummary,
} from '@/lib/staff/api-usage'
import { limitLevel, usedShare } from '@/lib/api-limits'
import { DailyBars } from '../charts'
import { formatWhen, PageTitle } from '../ui'

const SERVICE_LABEL: Record<ApiServiceUsage['service'], string> = {
  openai: 'OpenAI',
  firecrawl: 'Firecrawl',
  jina: 'Jina Reader',
  inngest: 'Inngest',
}

const LEVEL_TEXT = { ok: 'W normie', warn: 'Zostało mało: powyżej 80% planu zużyte', critical: 'Prawie wyczerpany: powyżej 95% planu zużyte' } as const
const LEVEL_CLASS = {
  ok: 'border-border-card-2 bg-white',
  warn: 'border-action bg-surface-accent-2',
  critical: 'border-danger bg-danger-bg',
} as const

const number = new Intl.NumberFormat('pl-PL')

function Limit({ limit }: { limit: ApiLimit }) {
  const label = SERVICE_LABEL[limit.service as ApiServiceUsage['service']] ?? limit.service
  const level = limitLevel(limit.remaining, limit.total)
  const used = usedShare(limit.remaining, limit.total)
  return (
    <li className={`rounded-tile border-2 p-4 ${LEVEL_CLASS[level]}`}>
      <p className="font-semibold">{label}</p>
      <p className="text-lg">
        Zostało {number.format(limit.remaining)} z {number.format(limit.total)} {limit.unit}
        {used !== null && <span> ({Math.round(used * 100)}% zużyte)</span>}
      </p>
      <p className="font-semibold">{LEVEL_TEXT[level]}</p>
      <p className="text-ink-soft">
        Stan z {formatWhen(limit.fetchedAt)}
        {limit.periodEnd && <> · okres rozliczeniowy do {formatWhen(limit.periodEnd)}</>}
      </p>
    </li>
  )
}

function Limits({ limits }: { limits: ApiLimit[] | null }) {
  return (
    <section aria-labelledby="limity" className="mb-10">
      <h2 id="limity" className="mb-2 text-xl font-bold">Limity u dostawców</h2>
      {limits === null ? (
        <p role="alert" className="rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
          Nie udało się wczytać limitów. Odśwież stronę.
        </p>
      ) : limits.length === 0 ? (
        <p>Brak danych o limitach. Stan jest pobierany raz dziennie, więc pierwszy wpis pojawi się po najbliższym przebiegu.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {limits.map((l) => (
            <Limit key={l.service} limit={l} />
          ))}
        </ul>
      )}
      <p className="mt-2 max-w-prose text-ink-soft">
        Tylko Firecrawl udostępnia stan planu przez API. OpenAI, Jina i Inngest nie mają takiego punktu dla zwykłego klucza,
        więc dla nich widać wyłącznie własny licznik poniżej; stan planu sprawdzisz w ich panelach.
      </p>
    </section>
  )
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
  const [limits, ...summaries] = await Promise.all([
    loadApiLimits(staff.supabase),
    ...API_USAGE_WINDOWS.map((days) => loadApiUsage(staff.supabase, days)),
  ])

  return (
    <>
      <PageTitle>Zużycie API</PageTitle>
      <p className="mb-8 max-w-prose text-ink-soft">
        Własny licznik wywołań zewnętrznych usług przy dodawaniu przepisów. Koszt OpenAI to szacunek z liczby tokenów i
        cennika zapisanego w aplikacji, nie faktura. Inngest liczy próby kroku „extract” (ponowienie liczy się ponownie).
        Dni liczone według czasu warszawskiego; licznik zbiera dane dopiero od wdrożenia, więc starsze wywołania nie są widoczne.
      </p>

      <Limits limits={limits} />

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
