import Link from 'next/link'
import { requirePermission } from '@/lib/staff/context'
import { readFlash } from '@/lib/staff/flash'
import { IMPORT_FILTER_LABELS, IMPORT_FILTERS, listImports, parseImportFilter } from '@/lib/staff/imports'
import { Banner, buttonOutlineClass, formatWhen, PageTitle } from '../ui'
import { retryImport } from './actions'

const OK_MESSAGES = { retried: 'Import ponowiony. Przepis pojawi się, gdy przetwarzanie się skończy.' } as const

type SearchParams = { status?: string; before?: string; ok?: string; error?: string }

const STATUS_LABEL = { pending: 'W toku', completed: 'Gotowy', failed: 'Nieudany' } as const

export default async function ImportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requirePermission('imports.read')
  const params = await searchParams
  const filter = parseImportFilter(params.status)
  const beforeId = Number(params.before)
  const page = await listImports(staff.supabase, {
    filter,
    beforeId: Number.isInteger(beforeId) && beforeId > 0 ? beforeId : null,
  })
  const canRetry = staff.permissions.has('imports.retry')

  return (
    <>
      <PageTitle>Kolejka importów</PageTitle>
      <Banner flash={readFlash(params, OK_MESSAGES)} />

      <nav aria-label="Filtr importów" className="mb-6 flex flex-wrap gap-2">
        {IMPORT_FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/importy?status=${f}`}
            aria-current={f === filter ? 'page' : undefined}
            className={`min-h-touch inline-flex items-center rounded-pill border-2 px-4 ${
              f === filter ? 'border-ink bg-ink font-semibold text-white' : 'border-field bg-white text-ink hover:bg-surface-3'
            }`}
          >
            {IMPORT_FILTER_LABELS[f]}
          </Link>
        ))}
      </nav>

      {!page ? (
        <p role="alert" className="rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
          Nie udało się wczytać listy. Odśwież stronę.
        </p>
      ) : page.imports.length === 0 ? (
        <p>{filter === 'problem' ? 'Brak błędów ani zawieszonych importów.' : 'Brak importów w tym widoku.'}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {page.imports.map((i) => {
            const retryable = i.status === 'failed' || i.stuck
            return (
              <li key={i.id} className="rounded-tile border-2 border-border-card-2 bg-white p-4">
                <p className="break-all font-semibold">{i.sharedUrl}</p>
                <p className="text-ink-soft">
                  {i.displayName ?? i.username ?? 'Konto bez nazwy'} · {formatWhen(i.updatedAt)} · próby: {i.attempts}
                </p>
                <p className="mt-1">
                  <strong className={i.status === 'failed' || i.stuck ? 'text-danger' : undefined}>
                    {i.stuck ? 'Zawieszony' : STATUS_LABEL[i.status]}
                  </strong>
                  {i.errorMessage && <span> — {i.errorMessage}</span>}
                </p>
                {canRetry && retryable && (
                  <form action={retryImport} className="mt-3">
                    <input type="hidden" name="shareId" value={i.id} />
                    <button type="submit" className={buttonOutlineClass}>
                      Ponów import
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {page?.nextBeforeId && (
        <p className="mt-6">
          <Link
            href={`/admin/importy?status=${filter}&before=${page.nextBeforeId}`}
            className="min-h-touch inline-flex items-center underline underline-offset-4"
          >
            Starsze importy
          </Link>
        </p>
      )}
    </>
  )
}
