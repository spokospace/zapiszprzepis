import Link from 'next/link'
import { AUDIT_RESOURCES, describePayload, listAudit, parseAuditFilters } from '@/lib/staff/audit'
import { requirePermission } from '@/lib/staff/context'
import { STAFF_RESOURCES } from '@/lib/staff/registry'
import { buttonClass, fieldClass, formatWhen, PageTitle } from '../ui'

type SearchParams = { resource?: string; actor?: string; from?: string; to?: string; before?: string }

const RESOURCE_LABELS = Object.fromEntries(STAFF_RESOURCES.map((r) => [r.name, r.label]))

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requirePermission('audit.read')
  const filters = parseAuditFilters(await searchParams)
  const page = await listAudit(staff.supabase, filters)

  const nextHref = page?.nextBeforeId
    ? `/admin/dziennik?${new URLSearchParams({
        ...(filters.resource ? { resource: filters.resource } : {}),
        ...(filters.actor ? { actor: filters.actor } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        before: String(page.nextBeforeId),
      }).toString()}`
    : null

  return (
    <>
      <PageTitle>Dziennik zmian</PageTitle>

      <form action="/admin/dziennik" method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="resource" className="font-semibold">
            Dział
          </label>
          <select id="resource" name="resource" defaultValue={filters.resource ?? ''} className={fieldClass}>
            <option value="">Wszystkie</option>
            {AUDIT_RESOURCES.map((name) => (
              <option key={name} value={name}>
                {RESOURCE_LABELS[name]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="actor" className="font-semibold">
            Kto (ID konta)
          </label>
          <input id="actor" name="actor" type="text" defaultValue={filters.actor ?? ''} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="font-semibold">
            Od
          </label>
          <input id="from" name="from" type="date" defaultValue={filters.from ?? ''} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="font-semibold">
            Do
          </label>
          <input id="to" name="to" type="date" defaultValue={filters.to ?? ''} className={fieldClass} />
        </div>
        <button type="submit" className={buttonClass}>
          Filtruj
        </button>
      </form>

      {!page ? (
        <p role="alert" className="rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
          Nie udało się wczytać dziennika. Odśwież stronę.
        </p>
      ) : page.entries.length === 0 ? (
        <p>Brak wpisów.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left align-top">
            <caption className="sr-only">Zmiany wykonane w panelu, od najnowszych</caption>
            <thead>
              <tr className="border-b-2 border-border-card-2">
                <th scope="col" className="py-2 pr-4">Kiedy</th>
                <th scope="col" className="py-2 pr-4">Kto</th>
                <th scope="col" className="py-2 pr-4">Co</th>
                <th scope="col" className="py-2 pr-4">Cel</th>
                <th scope="col" className="py-2">Przed → po</th>
              </tr>
            </thead>
            <tbody>
              {page.entries.map((e) => (
                <tr key={e.id} className="border-b border-border-card">
                  <td className="py-2 pr-4">{formatWhen(e.createdAt)}</td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/uzytkownicy/${e.actorId}`}
                      className="font-mono text-[15px] underline underline-offset-4"
                    >
                      {e.actorId.slice(0, 8)}
                    </Link>
                    <span className="block text-ink-soft">{e.via === 'mcp' ? 'MCP' : 'panel'}</span>
                  </td>
                  <td className="py-2 pr-4">
                    {RESOURCE_LABELS[e.resource] ?? e.resource}
                    <span className="block text-ink-soft">{e.operation}</span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-[15px] break-all">{e.targetId ?? '—'}</td>
                  <td className="py-2 break-words">
                    {describePayload(e.before)} → {describePayload(e.after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextHref && (
        <p className="mt-6">
          <Link href={nextHref} className="min-h-touch inline-flex items-center underline underline-offset-4">
            Starsze wpisy
          </Link>
        </p>
      )}
    </>
  )
}
