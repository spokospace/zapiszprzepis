import Link from 'next/link'
import { requirePermission } from '@/lib/staff/context'
import { readFlash } from '@/lib/staff/flash'
import { listUsers, parseUsersCursor } from '@/lib/staff/users'
import { Banner, buttonClass, fieldClass, formatWhen, PageTitle } from '../ui'

const OK_MESSAGES = { deleted: 'Konto zostało usunięte.' } as const

type SearchParams = { q?: string; after?: string; afterId?: string; ok?: string; error?: string }

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requirePermission('users.read')
  const params = await searchParams
  const query = params.q?.trim().slice(0, 100) ?? ''
  const page = await listUsers(staff.supabase, {
    query,
    after: parseUsersCursor(params.after, params.afterId),
  })
  const showEmail = staff.permissions.has('users.read_email')

  const nextHref = page?.next
    ? `/admin/uzytkownicy?${new URLSearchParams({
        ...(query ? { q: query } : {}),
        after: page.next.createdAt,
        afterId: page.next.id,
      }).toString()}`
    : null

  return (
    <>
      <PageTitle>Użytkownicy</PageTitle>
      <Banner flash={readFlash(params, OK_MESSAGES)} />

      <form action="/admin/uzytkownicy" method="get" role="search" className="mb-6 flex flex-wrap gap-3">
        <label htmlFor="q" className="sr-only">
          Szukaj użytkownika
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={showEmail ? 'Nazwa, nazwa użytkownika lub e-mail' : 'Nazwa lub nazwa użytkownika'}
          maxLength={100}
          className={`${fieldClass} max-w-md flex-1`}
        />
        <button type="submit" className={buttonClass}>
          Szukaj
        </button>
      </form>

      {!page ? (
        <p role="alert" className="rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
          Nie udało się wczytać listy. Odśwież stronę.
        </p>
      ) : page.users.length === 0 ? (
        <p>Brak wyników.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <caption className="sr-only">Konta użytkowników, od najnowszych</caption>
            <thead>
              <tr className="border-b-2 border-border-card-2">
                <th scope="col" className="py-2 pr-4">Konto</th>
                {showEmail && <th scope="col" className="py-2 pr-4">E-mail</th>}
                <th scope="col" className="py-2 pr-4">Założone</th>
                <th scope="col" className="py-2 pr-4">Logowanie</th>
                <th scope="col" className="py-2 pr-4 text-right">Przepisy</th>
                <th scope="col" className="py-2 pr-4 text-right">Ulubione</th>
                <th scope="col" className="py-2">Stan</th>
              </tr>
            </thead>
            <tbody>
              {page.users.map((u) => (
                <tr key={u.id} className="border-b border-border-card">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/uzytkownicy/${u.id}`}
                      className="min-h-touch inline-flex items-center font-semibold underline underline-offset-4"
                    >
                      {u.displayName ?? u.username ?? 'Bez nazwy'}
                    </Link>
                    {u.username && <span className="block text-ink-soft">@{u.username}</span>}
                  </td>
                  {showEmail && <td className="py-2 pr-4 break-all">{u.email ?? '—'}</td>}
                  <td className="py-2 pr-4">{formatWhen(u.createdAt)}</td>
                  <td className="py-2 pr-4">{u.provider}</td>
                  <td className="py-2 pr-4 text-right">{u.recipeCount}</td>
                  <td className="py-2 pr-4 text-right">{u.favoriteCount}</td>
                  <td className="py-2">
                    {u.blocked ? <strong className="text-danger">Zablokowane</strong> : 'Aktywne'}
                    {u.roles.length > 0 && <span className="block text-ink-soft">{u.roles.join(', ')}</span>}
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
            Starsze konta
          </Link>
        </p>
      )}
    </>
  )
}
