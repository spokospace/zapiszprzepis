'use client'

import { useActionState } from 'react'
import { buttonClass, fieldClass } from '../ui'
import { createAccessCode, type CreateCodeState } from './actions'

export function CreateCodeForm() {
  const [state, action, pending] = useActionState<CreateCodeState, FormData>(createAccessCode, null)

  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <label htmlFor="note" className="font-semibold">
        Dla kogo lub po co (nieobowiązkowo)
      </label>
      <input id="note" name="note" type="text" maxLength={200} className={fieldClass} />

      <label htmlFor="maxUses" className="font-semibold">
        Ile razy można go użyć
      </label>
      <input id="maxUses" name="maxUses" type="number" min={1} max={1000} defaultValue={1} required className={fieldClass} />

      <label htmlFor="expires" className="font-semibold">
        Ważny do (nieobowiązkowo)
      </label>
      <input id="expires" name="expires" type="date" className={fieldClass} />

      <button type="submit" disabled={pending} className={`${buttonClass} self-start`}>
        {pending ? 'Tworzenie…' : 'Utwórz kod'}
      </button>

      <div aria-live="polite">
        {state && 'error' in state && (
          <p role="alert" className="rounded-tile border-2 border-danger bg-danger-bg px-4 py-3 text-danger">
            {state.error}
          </p>
        )}
        {state && 'code' in state && (
          <div className="rounded-tile border-2 border-success bg-success-bg px-4 py-3">
            <p className="font-semibold">Skopiuj kod teraz. Po odświeżeniu strony nie da się go odczytać.</p>
            <p className="mt-2 select-all font-mono text-2xl tracking-wider">{state.code}</p>
          </div>
        )}
      </div>
    </form>
  )
}
