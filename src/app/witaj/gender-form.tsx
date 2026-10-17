'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { buttonClasses } from '@/app/components/ui/button'
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

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`${buttonClasses('primary', 'lg')} w-full text-[19px]`}
    >
      {pending ? 'Zapisuję…' : 'Zapisz i przejdź dalej'}
    </button>
  )
}

export function GenderForm({ next, error }: { next: string; error?: string }) {
  const [gender, setGender] = useState<Gender | null>(null)
  const errorMessage = error ? (ERRORS[error] ?? ERRORS.unknown) : null

  return (
    <form action={saveGender} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      {errorMessage && (
        <p role="alert" className="rounded-field border-2 border-danger bg-white px-4 py-3 text-[19px] text-danger">
          {errorMessage}
        </p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-[22px] font-bold text-ink">Jestem</legend>
        {OPTIONS.map((option) => {
          const selected = gender === option.value
          return (
            <label
              key={option.value}
              className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-field border-2 px-4 py-2 text-[19px] font-semibold text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                selected ? 'border-focus ring-3 ring-inset ring-focus' : 'border-field'
              }`}
            >
              <input
                type="radio"
                name="gender"
                value={option.value}
                checked={selected}
                onChange={() => setGender(option.value)}
                className="size-6 accent-focus focus-visible:outline-none"
              />
              {option.label}
              {selected && (
                <span className="ml-auto text-base font-bold text-focus">
                  <span aria-hidden="true">✓ </span>wybrane
                </span>
              )}
            </label>
          )
        })}
      </fieldset>

      <p className="text-base text-ink-soft">
        Dzięki temu dobrze odmienimy słowa, np. „Dodała” / „Dodał”.{' '}
        <strong>Tego wyboru nie można później zmienić.</strong>
      </p>

      <SubmitButton disabled={gender === null} />
    </form>
  )
}
