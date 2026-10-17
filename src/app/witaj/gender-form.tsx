'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { buttonClasses } from '@/app/components/ui/button'
import { useHydrated } from '@/app/components/ui/use-hydrated'
import type { Gender } from '@/lib/first-login'
import { saveGender } from './actions'

const OPTIONS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Kobietą' },
  { value: 'male', label: 'Mężczyzną' },
]

const ERRORS: Record<string, string> = {
  invalid: 'Wybierz jedną z odpowiedzi.',
  unknown: 'Nie udało się zapisać. Spróbuj ponownie.',
}

// "Dalej" stays inactive until a choice is made (3b), but only once JS runs:
// the server HTML keeps it enabled so the form still submits without JS, and
// the server answers an empty choice with the `invalid` message.
function SubmitButton({ chosen }: { chosen: boolean }) {
  const { pending } = useFormStatus()
  const hydrated = useHydrated()
  return (
    <button
      type="submit"
      disabled={pending || (hydrated && !chosen)}
      className={`${buttonClasses('primary', 'lg')} min-h-[60px] w-full text-[19px]`}
    >
      {pending ? 'Zapisuję…' : 'Dalej'}
    </button>
  )
}

/** Screen 3b (E01-S12, layout per E01-S12b): the one-time gender choice. */
export function GenderForm({ next, error }: { next: string; error?: string }) {
  const [gender, setGender] = useState<Gender | null>(null)
  const errorMessage = error ? (ERRORS[error] ?? ERRORS.unknown) : null

  return (
    <form action={saveGender} className="flex flex-1 flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      {errorMessage && (
        <p role="alert" className="rounded-field border-2 border-danger bg-white px-4 py-3 text-[19px] text-danger">
          {errorMessage}
        </p>
      )}

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-[19px] font-bold text-ink">Jestem</legend>
        {OPTIONS.map((option) => {
          const selected = gender === option.value
          // Native radios (sr-only) keep arrow keys and no-JS submits; the label
          // is the 60px target and carries the focus ring.
          return (
            <label
              key={option.value}
              className={`flex min-h-[60px] cursor-pointer items-center justify-center gap-2 rounded-field border-2 px-4 text-[19px] font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                selected ? 'border-ink bg-ink text-white' : 'border-field bg-white text-ink hover:bg-surface-3'
              }`}
            >
              <input
                type="radio"
                name="gender"
                value={option.value}
                checked={selected}
                onChange={() => setGender(option.value)}
                className="sr-only"
              />
              {selected && <span aria-hidden="true">✓</span>}
              {option.label}
            </label>
          )
        })}
      </fieldset>

      <p className="text-[16px] leading-normal text-ink-soft">Tego nie można później zmienić w ustawieniach.</p>

      <div className="mt-auto pt-2">
        <SubmitButton chosen={gender !== null} />
      </div>
    </form>
  )
}
