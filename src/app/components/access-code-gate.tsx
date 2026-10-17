'use client'

import { useActionState, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Check } from 'lucide-react'
import { redeemAccessCode, type RedeemState } from '@/app/(actions)/redeem-access-code'
import { AddRecipeForm } from '@/app/components/add-recipe-form'
import { Button } from '@/app/components/ui/button'
import { stripSearchParam } from '@/lib/strip-search-param'

const ERROR_MESSAGES: Partial<Record<RedeemState['status'], string>> = {
  invalid: 'Ten kod nie działa. Sprawdź, czy wpisano go bez błędów.',
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
      <div>
        <p
          role="status"
          className="mb-4 flex items-center gap-2 rounded-field bg-success-bg px-4 py-3 text-[19px] font-bold text-success"
        >
          <Check aria-hidden="true" className="h-6 w-6 shrink-0" />
          Gotowe — możesz dodawać przepisy.
        </p>
        {unlocked ?? <AddRecipeForm autoFocus />}
      </div>
    )
  }

  // Hidden while checking, so a repeated wrong code re-mounts the alert and
  // screen readers announce it again instead of staying silent.
  const error = pending ? undefined : ERROR_MESSAGES[state.status]
  const invalid = state.status === 'invalid'

  return (
    <section aria-labelledby="access-code-heading" className="rounded-card bg-surface-accent px-4 py-5 sm:px-5">
      <h2 id="access-code-heading" className="text-[24px] font-bold text-ink">
        Dodawanie przepisów
      </h2>
      {notice && <p className="mt-2 text-[19px] font-bold text-ink">Dodawanie przepisów wymaga kodu dostępu.</p>}
      <p className="mt-2 text-[19px] leading-normal text-ink-soft">
        Żeby dodawać własne przepisy, wpisz kod dostępu. Ulubione i galeria działają bez kodu.
      </p>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label htmlFor="access-code" className="text-[19px] font-bold text-ink">
          Kod dostępu
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
          required
          aria-invalid={invalid || undefined}
          aria-describedby={error ? ERROR_ID : undefined}
          className={`min-h-[56px] w-full rounded-field border-2 bg-white px-4 text-[19px] text-ink ${
            invalid ? 'border-danger' : 'border-field'
          }`}
        />
        {error && (
          <p id={ERROR_ID} role="alert" className="text-[17px] font-bold text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:self-start">
          {pending ? 'Sprawdzam…' : 'Odblokuj'}
        </Button>
      </form>
      <p className="mt-4 text-[16px] text-ink-soft">Pełny dostęp płatny — wkrótce.</p>
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
