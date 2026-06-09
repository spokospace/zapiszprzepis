'use client'

import { useState } from 'react'
import { forgotPassword } from './actions'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: 'Wpisz prawidłowy adres email.',
  user_not_found: 'Użytkownik z takim emailem nie istnieje.',
  unknown: 'Coś poszło nie tak. Spróbuj ponownie.',
}

interface ForgotPasswordFormProps {
  error?: string
  email?: string
  sent?: string
}

export function ForgotPasswordForm({ error, email, sent }: ForgotPasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown) : null
  const sentMessage = sent === '1' && email
    ? `Wysłaliśmy link resetowania na ${email} — sprawdź pocztę.`
    : null

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    try {
      await forgotPassword(formData)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="mt-4 text-sm text-zinc-600">
        Wpisz email, aby otrzymać link do resetowania hasła.
      </h2>

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

      <form action={handleSubmit} className="mt-6 flex flex-col gap-3">
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
          disabled={isLoading}
          defaultValue={email ?? ''}
          placeholder="ty@example.com"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-base font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isLoading && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {isLoading ? 'Wysyłanie...' : 'Wyślij link resetowania'}
        </button>
        <p className="text-center text-sm text-zinc-600">
          Pamiętasz hasło?{' '}
          <a href="/login" className="font-medium text-zinc-900 hover:underline">
            Zaloguj się
          </a>
        </p>
      </form>
    </div>
  )
}
