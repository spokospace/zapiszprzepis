'use client'

import { useState } from 'react'
import { signInWithEmail, signInWithPassword } from './actions'

type TabType = 'link' | 'password'

const ERROR_MESSAGES: Record<string, string> = {
  expired: 'Link wygasł. Wyślij sobie nowy.',
  used: 'Ten link został już użyty. Wyślij sobie nowy.',
  invalid: 'Link jest nieprawidłowy. Wyślij sobie nowy.',
  invalid_email: 'Wpisz prawidłowy adres email.',
  cooldown: 'Poczekaj chwilę, zanim wyślesz kolejny link.',
  invalid_credentials: 'Email lub hasło są nieprawidłowe.',
  weak_password: 'Hasło musi mieć co najmniej 6 znaków.',
  user_not_found: 'Użytkownik z takim emailem nie istnieje. Zarejestruj się.',
  unknown: 'Coś poszło nie tak. Spróbuj ponownie.',
}

interface SignInFormProps {
  error?: string
  email?: string
  sent?: string
}

export function SignInForm({ error, email, sent }: SignInFormProps) {
  const [tab, setTab] = useState<TabType>('link')
  const [isLoading, setIsLoading] = useState(false)
  const [formEmail, setFormEmail] = useState(email ?? '')

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown) : null
  const sentMessage = sent === '1' && email
    ? `Wysłaliśmy link na ${email} — sprawdź pocztę.`
    : null

  const handleLinkSubmit = async (formData: FormData) => {
    setIsLoading(true)
    try {
      await signInWithEmail(formData)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSubmit = async (formData: FormData) => {
    setIsLoading(true)
    try {
      await signInWithPassword(formData)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex gap-2 border-b border-zinc-200" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'link'}
          aria-controls="tab-link"
          onClick={() => setTab('link')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'link'
              ? 'border-b-2 border-zinc-900 text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'password'}
          aria-controls="tab-password"
          onClick={() => setTab('password')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'password'
              ? 'border-b-2 border-zinc-900 text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Hasło
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <p>{errorMessage}</p>
          {tab === 'password' && error === 'invalid_credentials' && (
            <p className="mt-2 text-xs text-red-700">
              Nie masz hasła?{' '}
              <a href="/forgot-password" className="font-medium underline hover:no-underline">
                Resetuj je tutaj
              </a>
            </p>
          )}
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

      {tab === 'link' ? (
        <form id="tab-link" action={handleLinkSubmit} className="mt-6 flex flex-col gap-3">
          <label htmlFor="email-link" className="text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email-link"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            disabled={isLoading}
            defaultValue={formEmail}
            placeholder="ty@example.com"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 rounded-md bg-zinc-900 px-4 py-2.5 text-base font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-400"
          >
            {isLoading ? 'Wysyłanie...' : 'Wyślij link'}
          </button>
        </form>
      ) : (
        <form id="tab-password" action={handlePasswordSubmit} className="mt-6 flex flex-col gap-3">
          <div>
            <label htmlFor="email-pass" className="text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              id="email-pass"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              disabled={isLoading}
              defaultValue={formEmail}
              placeholder="ty@example.com"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-zinc-700">
              Hasło
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isLoading}
              placeholder="••••••••"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 rounded-md bg-zinc-900 px-4 py-2.5 text-base font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-400"
          >
            {isLoading ? 'Logowanie...' : 'Zaloguj się'}
          </button>

          <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            Logujesz się po raz pierwszy? Możesz użyć{' '}
            <button
              type="button"
              onClick={() => setTab('link')}
              className="font-medium text-zinc-900 underline hover:no-underline"
            >
              linku email
            </button>
            {' '}zamiast hasła, lub{' '}
            <a href="/forgot-password" className="font-medium text-zinc-900 underline hover:no-underline">
              ustaw hasło
            </a>
            .
          </p>

          <div className="flex items-center justify-between text-sm">
            <a href="/forgot-password" className="font-medium text-zinc-900 hover:underline">
              Zapomniałem hasła
            </a>
            <a href="/signup" className="text-zinc-600 hover:text-zinc-900">
              Rejestracja
            </a>
          </div>
        </form>
      )}
    </div>
  )
}
