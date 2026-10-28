import { CODE_STATE_LABELS, listAccessCodes } from '@/lib/staff/access'
import { requirePermission } from '@/lib/staff/context'
import { formatWhen, PageTitle } from '../ui'
import { CreateCodeForm } from './create-code-form'

export default async function AccessPage() {
  const staff = await requirePermission('access.manage')
  const codes = await listAccessCodes(staff.supabase)

  return (
    <>
      <PageTitle>Kody dostępu</PageTitle>

      <section aria-labelledby="new-code" className="mb-10">
        <h2 id="new-code" className="mb-3 text-xl font-semibold">
          Nowy kod
        </h2>
        <CreateCodeForm />
      </section>

      <section aria-labelledby="codes">
        <h2 id="codes" className="mb-3 text-xl font-semibold">
          Utworzone kody
        </h2>
        {!codes ? (
          <p role="alert" className="rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
            Nie udało się wczytać listy. Odśwież stronę.
          </p>
        ) : codes.length === 0 ? (
          <p>Nie ma jeszcze żadnych kodów.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <caption className="sr-only">Kody dostępu, od najnowszych. Same kody nie są zapisane, tylko ich skrót.</caption>
              <thead>
                <tr className="border-b-2 border-border-card-2">
                  <th scope="col" className="py-2 pr-4">Opis</th>
                  <th scope="col" className="py-2 pr-4">Użycia</th>
                  <th scope="col" className="py-2 pr-4">Ważny do</th>
                  <th scope="col" className="py-2 pr-4">Utworzony</th>
                  <th scope="col" className="py-2">Stan</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-border-card">
                    <td className="py-2 pr-4">{c.note ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {c.useCount} z {c.maxUses}
                    </td>
                    <td className="py-2 pr-4">{formatWhen(c.expiresAt)}</td>
                    <td className="py-2 pr-4">{formatWhen(c.createdAt)}</td>
                    <td className="py-2">{CODE_STATE_LABELS[c.state]}</td>
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
