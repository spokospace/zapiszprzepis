'use client'

import { useActionState } from 'react'
import { connectCommand, TOKEN_LIFETIMES } from '@/lib/staff/tokens'
import { buttonClass, fieldClass } from '../ui'
import { createToken, type CreateTokenState } from './actions'

export function CreateTokenForm({ siteUrl }: { siteUrl: string }) {
  const [state, action, pending] = useActionState<CreateTokenState, FormData>(createToken, null)

  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <label htmlFor="label" className="font-semibold">
        Do czego służy (np. „laptop”)
      </label>
      <input id="label" name="label" type="text" maxLength={80} required className={fieldClass} />

      <label htmlFor="days" className="font-semibold">
        Ważny przez
      </label>
      <select id="days" name="days" defaultValue={90} className={fieldClass}>
        {TOKEN_LIFETIMES.map((l) => (
          <option key={l.days} value={l.days}>
            {l.label}
          </option>
        ))}
      </select>

      <button type="submit" disabled={pending} className={`${buttonClass} self-start`}>
        {pending ? 'Tworzenie…' : 'Utwórz token'}
      </button>

      <div aria-live="polite">
        {state && 'error' in state && (
          <p role="alert" className="rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
            {state.error}
          </p>
        )}
        {state && 'token' in state && (
          <div className="rounded-tile border-2 border-success bg-success-bg px-4 py-3">
            <p className="font-semibold">Skopiuj token teraz. Po odświeżeniu strony nie da się go odczytać.</p>
            <p className="mt-2 select-all break-all font-mono text-base">{state.token}</p>
            <p className="mt-4 font-semibold">Podłącz Claude Code jednym poleceniem:</p>
            <p className="mt-2 select-all break-all font-mono text-sm">{connectCommand(siteUrl, state.token)}</p>
          </div>
        )}
      </div>
    </form>
  )
}
