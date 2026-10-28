'use client'

import { useState } from 'react'
import Link from 'next/link'
import { INPUT, LABEL, NOTICE, SUBMIT } from '@/app/login/form-styles'
import { signUp } from './actions'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: 'Wpisz prawidłowy adres email.',
  invalid_code: 'Nieprawidłowy kod zaproszenia.',
  cooldown: 'Poczekaj chwilę, zanim wyślesz kolejny link.',
  unknown: 'Coś poszło nie tak. Spróbuj ponownie.',
}

interface SignUpFormProps {
  error?: string
  email?: string
  sent?: string
  inviteRequired: boolean
}

/** Email + invite code sign-up, in the 3a field style (kept by the owner beside Facebook/Google). */
export function SignUpForm({ error, email, sent, inviteRequired }: SignUpFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown) : null
  const sentMessage =
    sent === '1' && email ? `Wysłaliśmy link na ${email}. Kliknij go, aby dokończyć rejestrację.` : null

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    try {
      await signUp(formData)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      {errorMessage && (
        <div role="alert" className={`${NOTICE} border-danger bg-danger-bg font-bold text-danger`}>
          {errorMessage}
        </div>
      )}

      {sentMessage && (
        <div role="status" className={`${NOTICE} border-success bg-success-bg font-bold text-success`}>
          {sentMessage}
        </div>
      )}

      <form action={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="email" className={LABEL}>
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
            className={`mt-1 ${INPUT}`}
          />
        </div>

        {inviteRequired && (
          <div>
            <label htmlFor="invite-code" className={LABEL}>
              Kod zaproszenia
            </label>
            <input
              id="invite-code"
              name="inviteCode"
              type="text"
              autoComplete="off"
              required
              disabled={isLoading}
              aria-describedby="invite-code-help"
              className={`mt-1 ${INPUT}`}
            />
            <p id="invite-code-help" className="mt-1 text-[16px] text-ink-soft">
              Kod otrzymany od autora aplikacji.
            </p>
          </div>
        )}

        <button type="submit" disabled={isLoading} className={SUBMIT}>
          {isLoading ? 'Wysyłanie…' : 'Zarejestruj się'}
        </button>

        <p className="text-[17px] text-ink-soft">
          Masz już konto?{' '}
          <Link href="/login" className="font-bold text-ink">
            Zaloguj się
          </Link>
        </p>
      </form>
    </div>
  )
}
