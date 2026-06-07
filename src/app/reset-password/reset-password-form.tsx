'use client'

import { useState } from 'react'
import { resetPassword } from './actions'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: 'Link jest nieprawidłowy lub wygasł. Spróbuj resetowania hasła ponownie.',
  weak_password: 'Hasło musi mieć co najmniej 6 znaków.',
  password_mismatch: 'Hasła nie są identyczne.',
  unknown: 'Coś poszło nie tak. Spróbuj ponownie.',
}

interface ResetPasswordFormProps {
  accessToken?: string
  email?: string
  error?: string
}

export function ResetPasswordForm({ accessToken, email, error }: ResetPasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown) : null

  if (!accessToken) {
    return (
      <div className="w-full max-w-sm">
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          Link resetowania jest nieprawidłowy. Spróbuj ponownie z linku w emailu.
        </div>
        <p className="mt-6 text-center text-sm text-zinc-600">
          <a href="/forgot-password" className="font-medium text-zinc-900 hover:underline">
            Wyślij nowy link
          </a>
        </p>
      </div>
    )
  }

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    try {
      await resetPassword(formData, accessToken, email)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="mt-4 text-sm text-zinc-600">
        Ustaw nowe hasło
      </h2>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      <form action={handleSubmit} className="mt-6 flex flex-col gap-3">
        <div>
          <label htmlFor="password" className="text-sm font-medium text-zinc-700">
            Nowe hasło
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={isLoading}
            placeholder="Minimum 6 znaków"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="password-confirm" className="text-sm font-medium text-zinc-700">
            Powtórz hasło
          </label>
          <input
            id="password-confirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required
            disabled={isLoading}
            placeholder="Powtórz hasło"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 rounded-md bg-zinc-900 px-4 py-2.5 text-base font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-400"
        >
          {isLoading ? 'Ustawianie...' : 'Ustaw hasło'}
        </button>

        <p className="text-center text-sm text-zinc-600">
          Wróć do{' '}
          <a href="/login" className="font-medium text-zinc-900 hover:underline">
            logowania
          </a>
        </p>
      </form>
    </div>
  )
}
