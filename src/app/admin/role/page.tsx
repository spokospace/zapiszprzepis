import Link from 'next/link'
import { requirePermission } from '@/lib/staff/context'
import { readFlash } from '@/lib/staff/flash'
import { listStaff } from '@/lib/staff/roles'
import { Banner, buttonOutlineClass, PageTitle } from '../ui'
import { setRole } from './actions'

const ROLE_OK_MESSAGES = {
  role_granted: 'Rola nadana.',
  role_revoked: 'Rola odebrana.',
} as const

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const staff = await requirePermission('roles.manage')
  const result = await listStaff(staff.supabase)

  return (
    <>
      <PageTitle>Role</PageTitle>
      <Banner flash={readFlash(await searchParams, ROLE_OK_MESSAGES)} />

      {!result ? (
        <p role="alert" className="rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
          Nie udało się wczytać ról. Odśwież stronę.
        </p>
      ) : (
        <>
          <section aria-labelledby="members" className="mb-10">
            <h2 id="members" className="mb-3 text-xl font-semibold">
              Osoby z dostępem do panelu
            </h2>
            <p className="mb-3 max-w-xl text-ink-soft">
              Rolę nadasz na ekranie konta, w sekcji „Użytkownicy”. Własnej roli nie zmienisz i nie odbierzesz roli
              ostatniemu administratorowi.
            </p>
            <ul className="flex flex-col gap-3">
              {result.members.map((m) => (
                <li key={m.userId} className="rounded-tile border-2 border-border-card-2 bg-white p-4">
                  <Link
                    href={`/admin/uzytkownicy/${m.userId}`}
                    className="min-h-touch inline-flex items-center font-semibold underline underline-offset-4"
                  >
                    {m.displayName ?? m.username ?? 'Konto bez nazwy'}
                  </Link>
                  {m.userId !== staff.user.id && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {m.roles.map((role) => (
                        <li key={role}>
                          <form action={setRole} className="flex items-center gap-2">
                            <input type="hidden" name="id" value={m.userId} />
                            <input type="hidden" name="role" value={role} />
                            <input type="hidden" name="on" value="false" />
                            <span className="rounded-pill bg-surface-3 px-3 py-1 font-semibold">{role}</span>
                            <button type="submit" className={buttonOutlineClass} aria-label={`Odbierz rolę ${role}`}>
                              Odbierz
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.userId === staff.user.id && (
                    <p className="mt-1 text-ink-soft">To Ty: {m.roles.join(', ')}. Własnej roli nie zmienisz.</p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="catalog">
            <h2 id="catalog" className="mb-3 text-xl font-semibold">
              Co daje każda rola
            </h2>
            <dl className="flex flex-col gap-4">
              {result.roles.map((r) => (
                <div key={r.name}>
                  <dt className="font-semibold">
                    {r.name}
                    {r.description && <span className="font-normal text-ink-soft"> — {r.description}</span>}
                  </dt>
                  <dd className="break-words font-mono text-[15px] text-ink-soft">{r.permissions.join(', ')}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </>
  )
}
