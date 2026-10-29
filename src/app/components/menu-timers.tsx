'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Minus, Plus, Timer, X } from 'lucide-react'
import { useTimers } from '@/app/components/timer-provider'
import { formatClock, hasEnded, isRunning, remainingMs, timerCaption } from '@/lib/timer-store'

const CUSTOM_MIN = 1
const CUSTOM_MAX = 180

const STEPPER_BUTTON =
  'flex h-12 w-12 items-center justify-center text-ink disabled:opacity-40 focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-[#1d4ed8]'

const STEPPERS = [
  { label: 'Mniej minut', Icon: Minus, delta: -1 },
  { label: 'Więcej minut', Icon: Plus, delta: 1 },
] as const

/** Recipe slug from `/przepis/{slug}`, so a custom timer knows which recipe the reader is on. */
function recipeSlugFrom(pathname: string): string | null {
  const match = /^\/przepis\/([^/]+)/.exec(pathname)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * The "Minutniki" section at the top of the MENU panel (#611, Phase 1): the running timers, and a
 * custom timer of 1–180 minutes. Each timer's state is the same as on its card.
 */
export function MenuTimers() {
  const { timers, now, start, end, pause, resume } = useTimers()
  const pathname = usePathname()
  const [minutes, setMinutes] = useState(10)

  return (
    <section aria-labelledby="menu-timers-heading" className="border-b-2 border-border-card px-5 py-5">
      <h2 id="menu-timers-heading" className="mb-3 flex items-center gap-2 text-[19px] font-extrabold text-ink">
        <Timer aria-hidden="true" className="h-5 w-5" />
        Minutniki
      </h2>

      {timers.length === 0 ? (
        <p className="mb-4 text-[16px] text-[#374151]">
          Nic nie odlicza. Kliknij podkreślony czas w kroku przepisu albo ustaw własny.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {timers.map((timer) => {
            const ended = hasEnded(timer, now)
            const running = isRunning(timer)
            const caption = timerCaption(timer, '')
            return (
              <li key={timer.id} className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-ink break-words">
                    {timer.name}
                    {!ended && !running && ' · pauza'}
                  </p>
                  {caption && <p className="text-[14px] text-[#374151] break-words">{caption}</p>}
                </div>
                <p
                  className={`rounded-md px-2 text-[20px] font-extrabold tabular-nums ${
                    ended ? 'bg-[#fff7ed] text-[#9a3412]' : 'text-ink'
                  }`}
                >
                  {ended ? 'czas minął' : formatClock(remainingMs(timer, now))}
                </p>
                {!ended && (
                  <button
                    type="button"
                    onClick={() => (running ? pause(timer.id) : resume(timer.id))}
                    className="min-h-12 rounded-pill border-2 border-border-dark px-3 text-[15px] font-bold text-ink focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
                  >
                    {running ? 'Pauza' : 'Wznów'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => end(timer.id)}
                  aria-label={`Usuń minutnik ${timer.name}`}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill text-ink hover:bg-surface-3 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
                >
                  <X aria-hidden="true" className="h-6 w-6" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[17px] font-bold text-ink">Własny:</span>
        <div className="flex items-center overflow-hidden rounded-xl border-2 border-border-dark">
          {STEPPERS.map(({ label, Icon, delta }) => (
            <span key={label} className="contents">
              {delta > 0 && (
                <span className="min-w-[4.5rem] text-center text-[18px] font-bold tabular-nums text-ink" aria-live="polite">
                  {minutes} min
                </span>
              )}
              <button
                type="button"
                aria-label={label}
                disabled={minutes + delta < CUSTOM_MIN || minutes + delta > CUSTOM_MAX}
                onClick={() => setMinutes((m) => Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, m + delta)))}
                className={STEPPER_BUTTON}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            start({ name: 'Własny minutnik', recipeSlug: recipeSlugFrom(pathname ?? ''), recipeTitle: null, step: null, next: null, addMin: 5 }, minutes)
          }
          className="min-h-12 rounded-pill bg-black px-5 text-[17px] font-bold text-white focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
        >
          Start
        </button>
      </div>
    </section>
  )
}
