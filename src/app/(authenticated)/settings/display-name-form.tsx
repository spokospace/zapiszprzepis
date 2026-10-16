'use client'

import { useActionState, useState } from 'react'
import { updateDisplayName, type DisplayNameFormState } from './actions'

const initialState: DisplayNameFormState = { status: 'idle' }

/** Minimal editor for "nazwa wyświetlana" (E01-S18). Full profile screen is S13. */
export function DisplayNameForm({ initialDisplayName }: { initialDisplayName: string }) {
  const [state, formAction, pending] = useActionState(updateDisplayName, initialState)
  // Controlled on purpose: React 19 resets uncontrolled fields after a form action,
  // which would wipe what the user typed whenever validation rejects it.
  const [value, setValue] = useState(initialDisplayName)

  return (
    <form action={formAction} className="flex flex-col gap-3 px-5 py-4">
      <label htmlFor="displayName" className="text-base font-medium text-gray-900">
        Nazwa przy przepisach
      </label>
      <p id="displayName-help" className="text-sm text-gray-500">
        Tak podpisujemy przepisy, które dodasz („Dodała…”).
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="displayName"
          name="displayName"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={60}
          required
          aria-describedby={state.status !== 'idle' ? 'displayName-help displayName-status' : 'displayName-help'}
          className="min-h-[48px] flex-1 rounded-lg border-2 border-gray-400 px-3 text-base text-gray-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-[48px] rounded-lg bg-orange-700 px-5 font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </div>
      {state.status !== 'idle' && state.message && (
        <p
          id="displayName-status"
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-sm font-medium ${state.status === 'error' ? 'text-red-700' : 'text-green-700'}`}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}
