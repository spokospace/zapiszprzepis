'use client'

import { useState } from 'react'
import { signInWithEmail, signInWithPassword } from './actions'
import { INPUT, LABEL, NOTICE, SUBMIT } from './form-styles'

type TabType = 'link' | 'password'

// 48px tabs; field styles in form-styles.ts.
const tabClass = (active: boolean) =>
  `min-h-[48px] px-4 text-[17px] font-bold transition-colors ${active ? '-mb-0.5 border-b-4 border-ink text-ink' : 'text-ink-soft hover:text-ink'}`

const ERROR_MESSAGES: Record<string, string> = {
  expired: 'Link wygasł lub został już użyty. Wyślij sobie nowy.',
  used: 'Ten link został już użyty. Wyślij sobie nowy.',
  invalid: 'Link jest nieprawidłowy. Wyślij sobie nowy.',
  invalid_email: 'Wpisz prawidłowy adres email.',
  cooldown: 'Poczekaj chwilę, zanim wyślesz kolejny link.',
  invalid_credentials: 'Email lub hasło są nieprawidłowe.',
  weak_password: 'Hasło musi mieć co najmniej 6 znaków.',
  user_not_found: 'Użytkownik z takim emailem nie istnieje. Zarejestruj się.',
  no_account: 'Nie znaleziono konta. Zarejestruj się z kodem zaproszenia.',
  unknown: 'Coś poszło nie tak. Spróbuj ponownie.',
  // E01-S12 — Google/Facebook sign-in (mapped in /auth/callback and the action).
  oauth_cancelled: 'Logowanie zostało przerwane. Spróbuj ponownie.',
  oauth_no_email: 'Twoje konto Facebook nie ma adresu email. Zaloguj się przez Google albo linkiem email.',
  oauth_email_exists: 'Masz już konto z tym adresem email. Zaloguj się linkiem email.',
  oauth_verify_email: 'Wysłaliśmy email z potwierdzeniem — kliknij link, a potem zaloguj się ponownie.',
  oauth_unavailable: 'Logowanie przez tę usługę jest chwilowo niedostępne.',
  oauth_failed: 'Nie udało się rozpocząć logowania. Spróbuj ponownie.',
}

interface SignInFormProps {
  error?: string
  email?: string
  sent?: string
  success?: string
  /** Where to return after logging in (E01-S06); validated server-side by the actions. */
  next?: string
}

export function SignInForm({ error, email, sent, success, next }: SignInFormProps) {
  const [tab, setTab] = useState<TabType>('link')
  const [isLoading, setIsLoading] = useState(false)
  const [formEmail, setFormEmail] = useState(email ?? '')

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown) : null
  const sentMessage = sent === '1' && email
    ? `Wysłaliśmy link na ${email} — sprawdź pocztę.`
    : null
  const successMessage = success === 'password_reset'
    ? 'Hasło zostało zmienione. Zaloguj się nowym hasłem.'
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
    <div className="w-full">
      <div className="flex gap-2 border-b-2 border-border-card" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'link'}
          aria-controls="tab-link"
          onClick={() => setTab('link')}
          className={tabClass(tab === 'link')}
        >
          Link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'password'}
          aria-controls="tab-password"
          onClick={() => setTab('password')}
          className={tabClass(tab === 'password')}
        >
          Hasło
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className={`${NOTICE} border-danger bg-danger-bg font-bold text-danger`}
        >
          <p>{errorMessage}</p>
          {tab === 'password' && error === 'invalid_credentials' && (
            <p className="mt-2 font-normal">
              Nie masz hasła?{' '}
              <a href="/forgot-password" className="font-bold text-danger">
                Resetuj je tutaj
              </a>
            </p>
          )}
        </div>
      )}

      {sentMessage && (
        <div
          role="status"
          className={`${NOTICE} border-success bg-success-bg font-bold text-success`}
        >
          {sentMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className={`${NOTICE} border-success bg-success-bg font-bold text-success`}
        >
          {successMessage}
        </div>
      )}

      {tab === 'link' ? (
        <form id="tab-link" action={handleLinkSubmit} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="next" value={next ?? ''} />
          <label htmlFor="email-link" className={LABEL}>
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
            className={INPUT}
          />
          <button
            type="submit"
            disabled={isLoading}
            className={SUBMIT}
          >
            {isLoading ? 'Wysyłanie...' : 'Wyślij link'}
          </button>
        </form>
      ) : (
        <form id="tab-password" action={handlePasswordSubmit} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="next" value={next ?? ''} />
          <div>
            <label htmlFor="email-pass" className={LABEL}>
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
              className={`mt-1 ${INPUT}`}
            />
          </div>
          <div>
            <label htmlFor="password" className={LABEL}>
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
              className={`mt-1 ${INPUT}`}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={SUBMIT}
          >
            {isLoading ? 'Logowanie...' : 'Zaloguj się'}
          </button>

          <p className="mt-3 rounded-tile bg-surface-2 px-4 py-3 text-[16px] text-ink-soft">
            Logujesz się po raz pierwszy? Możesz użyć{' '}
            <button
              type="button"
              onClick={() => setTab('link')}
              className="font-bold text-ink underline"
            >
              linku email
            </button>
            {' '}zamiast hasła, lub{' '}
            <a href="/forgot-password" className="font-bold text-ink underline">
              ustaw hasło
            </a>
            .
          </p>

          <div className="flex flex-wrap items-center justify-between gap-x-4 text-[16px]">
            <a href="/forgot-password" className="inline-flex min-h-[48px] items-center font-bold text-ink">
              Zapomniałem hasła
            </a>
            <a href="/signup" className="inline-flex min-h-[48px] items-center text-ink-soft hover:text-ink">
              Rejestracja
            </a>
          </div>
        </form>
      )}
    </div>
  )
}
