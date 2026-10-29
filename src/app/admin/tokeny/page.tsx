import { requirePermission } from '@/lib/staff/context'
import { readFlash } from '@/lib/staff/flash'
import { listTokens, TOKEN_STATE_LABELS } from '@/lib/staff/tokens'
import { Banner, buttonDangerClass, formatWhen, PageTitle } from '../ui'
import { revokeToken } from './actions'
import { CreateTokenForm } from './create-token-form'

const OK_MESSAGES = { revoked: 'Token unieważniony. Przestał działać.' } as const

export default async function TokensPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const staff = await requirePermission('tokens.own')
  const tokens = await listTokens(staff.supabase)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://zapiszprzepis.pl'

  return (
    <>
      <PageTitle>Moje tokeny</PageTitle>
      <Banner flash={readFlash(await searchParams, OK_MESSAGES)} />
      <p className="mb-6 max-w-2xl text-ink-soft">
        Token pozwala Claude Code wykonywać w panelu to, co możesz Ty, na Twoim koncie i z Twoją rolą. Jeśli zabierzemy
        Ci rolę albo zablokujemy konto, wszystkie Twoje tokeny przestają działać. Każde wywołanie trafia do dziennika
        zmian.
      </p>

      <section aria-labelledby="new-token" className="mb-10">
        <h2 id="new-token" className="mb-3 text-xl font-semibold">
          Nowy token
        </h2>
        <CreateTokenForm siteUrl={siteUrl} />
      </section>

      <section aria-labelledby="tokens">
        <h2 id="tokens" className="mb-3 text-xl font-semibold">
          Twoje tokeny
        </h2>
        {!tokens ? (
          <p role="alert" className="rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
            Nie udało się wczytać listy. Odśwież stronę.
          </p>
        ) : tokens.length === 0 ? (
          <p>Nie masz jeszcze żadnego tokenu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <caption className="sr-only">Twoje tokeny, od najnowszych. Pełnego tokenu nie da się odczytać, widać tylko jego początek.</caption>
              <thead>
                <tr className="border-b-2 border-border-card-2">
                  <th scope="col" className="py-2 pr-4">Opis</th>
                  <th scope="col" className="py-2 pr-4">Początek</th>
                  <th scope="col" className="py-2 pr-4">Ważny do</th>
                  <th scope="col" className="py-2 pr-4">Ostatnio użyty</th>
                  <th scope="col" className="py-2 pr-4">Stan</th>
                  <th scope="col" className="py-2">
                    <span className="sr-only">Akcje</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id} className="border-b border-border-card">
                    <td className="py-2 pr-4">{t.label}</td>
                    <td className="py-2 pr-4 font-mono">{t.prefix}…</td>
                    <td className="py-2 pr-4">{formatWhen(t.expiresAt)}</td>
                    <td className="py-2 pr-4">{formatWhen(t.lastUsedAt)}</td>
                    <td className="py-2 pr-4">{TOKEN_STATE_LABELS[t.state]}</td>
                    <td className="py-2">
                      {t.state === 'active' && (
                        <form action={revokeToken}>
                          <input type="hidden" name="id" value={t.id} />
                          <button type="submit" className={buttonDangerClass} aria-label={`Unieważnij token „${t.label}”`}>
                            Unieważnij
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
