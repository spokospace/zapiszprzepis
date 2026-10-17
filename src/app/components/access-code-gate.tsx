'use client'

import { useActionState, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Check, CircleAlert, Lock } from 'lucide-react'
import { redeemAccessCode, type RedeemState } from '@/app/(actions)/redeem-access-code'
import { AddRecipeForm } from '@/app/components/add-recipe-form'
import { Button } from '@/app/components/ui/button'
import { stripSearchParam } from '@/lib/strip-search-param'

const ERROR_MESSAGES: Partial<Record<RedeemState['status'], string>> = {
  invalid: 'Ten kod nie działa. Sprawdź litery i spróbuj jeszcze raz.',
  rate_limited: 'Za dużo prób. Spróbuj ponownie za kwadrans.',
  error: 'Coś poszło nie tak. Spróbuj ponownie.',
}

const ERROR_ID = 'access-code-error'

type ViewProps = {
  state: RedeemState
  pending: boolean
  formAction: (formData: FormData) => void
  code: string
  onCodeChange: (value: string) => void
  /** Arrived from a blocked add (Share Target, stale tab): ?add_error=no_access. */
  notice?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  /** What replaces the gate once a code is accepted; the home's add form by default. */
  unlocked?: ReactNode
}

/** Screen 3c, pure view (rendered by AccessCodeGate; split out for tests). */
export function AccessCodeGateView({ state, pending, formAction, code, onCodeChange, notice, inputRef, unlocked }: ViewProps) {
  if (state.status === 'ok') {
    return (
      <div className="flex flex-col gap-[18px]">
        <div role="status" className="flex flex-col gap-[18px]">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success">
            <Check aria-hidden="true" className="h-[34px] w-[34px]" />
          </span>
          <p className="text-[28px] leading-tight font-bold text-ink">Gotowe! Możesz dodawać przepisy.</p>
          <p className="text-[18px] leading-normal text-ink-soft">
            Kod został przypisany do Twojego konta. Nie trzeba go wpisywać ponownie.
          </p>
        </div>
        {unlocked ?? <AddRecipeForm autoFocus />}
      </div>
    )
  }

  // Hidden while checking, so a repeated wrong code re-mounts the alert and
  // screen readers announce it again instead of staying silent.
  const error = pending ? undefined : ERROR_MESSAGES[state.status]
  const invalid = state.status === 'invalid'

  return (
    <section
      aria-labelledby="access-code-heading"
      className="flex flex-col gap-[18px] rounded-card border-2 border-border-card bg-white px-4 py-6 sm:px-5"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-accent text-action-text">
        <Lock aria-hidden="true" className="h-[30px] w-[30px]" />
      </span>
      <h2 id="access-code-heading" className="text-[28px] leading-tight font-bold text-ink">
        Dodawanie własnych przepisów
      </h2>
      {notice && <p className="text-[19px] font-bold text-ink">Dodawanie przepisów wymaga kodu dostępu.</p>}
      <p className="text-[18px] leading-normal text-ink-soft">
        Wklejasz link z Facebooka, YouTube lub bloga, a my spisujemy przepis po polsku. Ta funkcja jest w pełnym
        dostępie.
      </p>
      <form action={formAction} className="flex flex-col gap-2">
        <label htmlFor="access-code" className="text-[19px] font-bold text-ink">
          Masz kod?
        </label>
        <input
          ref={inputRef}
          id="access-code"
          name="code"
          type="text"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={200}
          placeholder="np. ABCD1234"
          required
          aria-invalid={invalid || undefined}
          aria-describedby={error ? ERROR_ID : undefined}
          // Uppercase is display only: the server normalizes case, spaces and dashes.
          className={`min-h-[60px] w-full rounded-field border-2 bg-white px-[14px] font-mono text-[20px] font-bold tracking-[.06em] text-ink uppercase placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-muted ${
            invalid ? 'border-danger' : 'border-field'
          }`}
        />
        {error && (
          <p id={ERROR_ID} role="alert" className="flex items-center gap-2 text-[17px] font-bold text-danger">
            <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="min-h-[58px] w-full text-[19px]">
          {pending ? 'Sprawdzam…' : 'Odblokuj'}
        </Button>
      </form>
      {/* "albo / Zobacz pełny dostęp" stays out until payments exist (owner decision, #281). */}
      <p className="text-[16px] leading-normal text-ink-soft">Ulubione działają bez ograniczeń, z kodem i bez.</p>
    </section>
  )
}

const initialState: RedeemState = { status: 'idle' }

/**
 * E01-S11 screen 3c — the access-code gate shown instead of the add form to a
 * signed-in user without full access. The server re-checks access on every add
 * (getFullAccess + RLS); this screen is only the way in.
 */
export function AccessCodeGate({ notice, unlocked }: { notice?: boolean; unlocked?: ReactNode }) {
  const [state, formAction, pending] = useActionState(redeemAccessCode, initialState)
  // Controlled on purpose: React 19 resets uncontrolled fields after a form action,
  // which would wipe the code the user typed when it is rejected.
  const [code, setCode] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // The disabled button drops focus to <body> while checking; put it back in the
  // field after a rejection so the user can correct the code right away.
  useEffect(() => {
    if (state.status !== 'idle' && state.status !== 'ok') inputRef.current?.focus()
  }, [state])

  useEffect(() => {
    if (notice) stripSearchParam('add_error')
  }, [notice])

  return (
    <AccessCodeGateView
      state={state}
      pending={pending}
      formAction={formAction}
      code={code}
      onCodeChange={setCode}
      notice={notice}
      inputRef={inputRef}
      unlocked={unlocked}
    />
  )
}
