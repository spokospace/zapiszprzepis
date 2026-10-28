import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/staff/context'
import { readFlash } from '@/lib/staff/flash'
import { DELETE_CONFIRMATION, getUser } from '@/lib/staff/users'
import { Banner, buttonClass, buttonDangerClass, buttonOutlineClass, fieldClass, formatWhen, PageTitle } from '../../ui'
import { setFullAccess } from '../../dostep/actions'
import { blockUser, deleteUser, unblockUser } from '../actions'

const OK_MESSAGES = {
  blocked: 'Konto zablokowane. Użytkownik jest wylogowany i nie zaloguje się ponownie.',
  unblocked: 'Konto odblokowane.',
  access_granted: 'Pełny dostęp nadany. Użytkownik może dodawać przepisy.',
  access_revoked: 'Pełny dostęp odebrany.',
} as const

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; error?: string }>
}) {
  const staff = await requirePermission('users.read')
  const { id } = await params
  const user = await getUser(staff.supabase, id)
  if (!user) notFound()

  const canBlock = staff.permissions.has('users.block')
  const canDelete = staff.permissions.has('users.delete')
  // The database refuses these too; the panel just does not offer what cannot work.
  const protectedAccount = user.id === staff.user.id || user.roles.length > 0

  return (
    <>
      <p className="mb-2">
        <Link href="/admin/uzytkownicy" className="min-h-touch inline-flex items-center underline underline-offset-4">
          Wszyscy użytkownicy
        </Link>
      </p>
      <PageTitle>{user.displayName ?? user.username ?? 'Konto bez nazwy'}</PageTitle>
      <Banner flash={readFlash(await searchParams, OK_MESSAGES)} />

      <dl className="mb-8 grid max-w-xl grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
        <dt className="text-ink-soft">Nazwa użytkownika</dt>
        <dd>{user.username ? `@${user.username}` : '—'}</dd>
        {staff.permissions.has('users.read_email') && (
          <>
            <dt className="text-ink-soft">E-mail</dt>
            <dd className="break-all">{user.email ?? '—'}</dd>
          </>
        )}
        <dt className="text-ink-soft">Założone</dt>
        <dd>{formatWhen(user.createdAt)}</dd>
        <dt className="text-ink-soft">Ostatnie logowanie</dt>
        <dd>{formatWhen(user.lastSignInAt)}</dd>
        <dt className="text-ink-soft">Logowanie</dt>
        <dd>{user.provider}</dd>
        <dt className="text-ink-soft">Przepisy</dt>
        <dd>{user.recipeCount}</dd>
        <dt className="text-ink-soft">Ulubione</dt>
        <dd>{user.favoriteCount}</dd>
        <dt className="text-ink-soft">Pełny dostęp</dt>
        <dd>{user.fullAccess ? 'Tak' : 'Nie'}</dd>
        <dt className="text-ink-soft">Rola w panelu</dt>
        <dd>{user.roles.length > 0 ? user.roles.join(', ') : '—'}</dd>
        <dt className="text-ink-soft">Stan</dt>
        <dd>{user.blocked ? <strong className="text-danger">Zablokowane</strong> : 'Aktywne'}</dd>
      </dl>

      {protectedAccount && (canBlock || canDelete) && (
        <p className="mb-6 max-w-xl rounded-tile border-2 border-border-card-2 bg-white px-4 py-3">
          {user.id === staff.user.id
            ? 'To Twoje konto. Nie zablokujesz go ani nie usuniesz.'
            : 'To konto ma rolę w panelu. Aby je zablokować lub usunąć, administrator musi najpierw odebrać rolę.'}
        </p>
      )}

      {staff.permissions.has('access.manage') && (
        <section aria-labelledby="access-heading" className="mb-8 max-w-xl">
          <h2 id="access-heading" className="mb-2 text-xl font-semibold">
            Pełny dostęp
          </h2>
          <form action={setFullAccess}>
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="on" value={user.fullAccess ? 'false' : 'true'} />
            <button type="submit" className={user.fullAccess ? buttonOutlineClass : buttonClass}>
              {user.fullAccess ? 'Odbierz pełny dostęp' : 'Nadaj pełny dostęp'}
            </button>
          </form>
        </section>
      )}

      {canBlock && !protectedAccount && (
        <section aria-labelledby="block-heading" className="mb-8 max-w-xl">
          <h2 id="block-heading" className="mb-2 text-xl font-semibold">
            {user.blocked ? 'Odblokuj konto' : 'Zablokuj konto'}
          </h2>
          {user.blocked ? (
            <form action={unblockUser}>
              <input type="hidden" name="id" value={user.id} />
              <button type="submit" className={buttonOutlineClass}>
                Odblokuj konto
              </button>
            </form>
          ) : (
            <form action={blockUser} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={user.id} />
              <p>Użytkownik zostanie wylogowany i nie zaloguje się, dopóki go nie odblokujesz. Jego dane zostają.</p>
              <label htmlFor="reason" className="font-semibold">
                Powód (nieobowiązkowo, trafia do dziennika)
              </label>
              <input id="reason" name="reason" type="text" maxLength={200} className={fieldClass} />
              <button type="submit" className={`${buttonDangerClass} self-start`}>
                Zablokuj konto
              </button>
            </form>
          )}
        </section>
      )}

      {canDelete && !protectedAccount && (
        <section aria-labelledby="delete-heading" className="max-w-xl">
          <h2 id="delete-heading" className="mb-2 text-xl font-semibold">
            Usuń konto i dane
          </h2>
          <form action={deleteUser} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={user.id} />
            <p>
              Tego nie da się cofnąć. Znika profil, ulubione i prywatne przepisy. Przepisy, które ktoś ma w ulubionych,
              przechodzą na tego, kto dodał je do ulubionych najwcześniej.
            </p>
            <label htmlFor="confirm" className="font-semibold">
              Aby potwierdzić, wpisz {DELETE_CONFIRMATION}
            </label>
            <input id="confirm" name="confirm" type="text" autoComplete="off" className={fieldClass} />
            <button type="submit" className={`${buttonClass} self-start bg-danger hover:bg-danger`}>
              Usuń konto
            </button>
          </form>
        </section>
      )}
    </>
  )
}
