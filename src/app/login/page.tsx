import Image from 'next/image'
import { signInWithEmail } from './actions'

const ERROR_MESSAGES: Record<string, string> = {
  expired: 'Link wygasł. Wyślij sobie nowy.',
  used: 'Ten link został już użyty. Wyślij sobie nowy.',
  invalid: 'Link jest nieprawidłowy. Wyślij sobie nowy.',
  invalid_email: 'Wpisz prawidłowy adres email.',
  cooldown: 'Poczekaj chwilę, zanim wyślesz kolejny link.',
  unknown: 'Coś poszło nie tak. Spróbuj ponownie.',
}

type SearchParams = Promise<{
  error?: string
  email?: string
  sent?: string
}>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { error, email, sent } = await searchParams
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown) : null
  const sentMessage = sent === '1' && email
    ? `Wysłaliśmy link na ${email} — sprawdź pocztę.`
    : null

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1>
          <Image
            src="/logo.svg"
            alt="ZapiszPrzepis"
            width={1970}
            height={668}
            priority
            unoptimized
            className="block h-auto w-48"
          />
        </h1>
        <p className="mt-4 text-sm text-zinc-600">
          Wpisz email, żeby zalogować się jednorazowym linkiem.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorMessage}
          </div>
        )}

        {sentMessage && (
          <div
            role="status"
            className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {sentMessage}
          </div>
        )}

        <form action={signInWithEmail} className="mt-6 flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            defaultValue={email ?? ''}
            placeholder="ty@example.com"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          />
          <button
            type="submit"
            className="mt-2 rounded-md bg-zinc-900 px-4 py-2.5 text-base font-medium text-white hover:bg-zinc-800"
          >
            Wyślij link
          </button>
        </form>
      </div>
    </main>
  )
}
