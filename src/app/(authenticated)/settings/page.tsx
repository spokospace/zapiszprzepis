import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PageContainer } from '@/app/components/page-container'

export const metadata: Metadata = { title: 'Ustawienia · ZapiszPrzepis' }

const dateFormat = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Warsaw',
})

function formatDate(value: string | undefined): string {
  return value ? dateFormat.format(new Date(value)) : '—'
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  // RLS scopes the count to the signed-in user, so it can run alongside getUser().
  const [
    {
      data: { user },
    },
    { count: recipeCount },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('recipes').select('id', { count: 'exact', head: true }),
  ])

  if (!user) redirect('/login')

  const rows: { label: string; value: string }[] = [
    { label: 'Adres email', value: user.email ?? '—' },
    { label: 'Konto założone', value: formatDate(user.created_at) },
    { label: 'Ostatnie logowanie', value: formatDate(user.last_sign_in_at) },
    { label: 'Zapisane przepisy', value: String(recipeCount ?? 0) },
  ]

  return (
    <main className="min-h-screen bg-white">
      <PageContainer narrow className="py-6 sm:py-12">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Ustawienia</h1>
        <section aria-labelledby="profile-heading" className="rounded-xl border border-gray-200">
          <h2
            id="profile-heading"
            className="border-b border-gray-100 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-gray-500"
          >
            Profil
          </h2>
          <dl className="divide-y divide-gray-100">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:justify-between">
                <dt className="text-sm text-gray-500">{label}</dt>
                <dd className="break-all text-base font-medium text-gray-900 sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </PageContainer>
    </main>
  )
}
