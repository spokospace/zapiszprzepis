import type { ReactNode } from 'react'
import type { Flash } from '@/lib/staff/flash'

// Small pieces shared by the admin screens. Plain markup on the site's tokens;
// every control keeps the 48px touch target the rest of the app uses.

export const buttonClass =
  'min-h-touch inline-flex items-center justify-center rounded-pill bg-action px-5 font-semibold text-white hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

export const buttonOutlineClass =
  'min-h-touch inline-flex items-center justify-center rounded-pill border-2 border-field bg-white px-5 font-semibold text-ink hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

export const buttonDangerClass =
  'min-h-touch inline-flex items-center justify-center rounded-pill border-2 border-danger bg-white px-5 font-semibold text-danger hover:bg-danger-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

export const fieldClass =
  'min-h-touch w-full rounded-tile border-2 border-field bg-white px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-2xl font-bold">{children}</h1>
}

/** The result of the last action. role=status/alert so a screen reader announces it. */
export function Banner({ flash }: { flash: Flash | null }) {
  if (!flash) return null
  const ok = flash.kind === 'ok'
  return (
    <p
      role={ok ? 'status' : 'alert'}
      className={`mb-4 rounded-tile border-2 px-4 py-3 ${ok ? 'border-success bg-success-bg text-ink' : 'border-danger bg-danger-bg text-danger'}`}
    >
      {flash.text}
    </p>
  )
}

const dateTime = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Warsaw' })

/** A timestamp for staff, in Warsaw time; an em dash when absent. */
export function formatWhen(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date)
}
