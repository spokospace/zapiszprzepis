'use client'

import { useTimers } from '@/app/components/timer-provider'
import { formatClock, hasEnded, isRunning, remainingMs, timerCaption } from '@/lib/timer-store'

/** Pill buttons on the timer cards: 44 px tall, a 3 px focus ring (WCAG 2.2 AA, ZASADY_PROJEKTU). */
const CARD_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-pill text-[16px] font-bold focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]'
const CARD_BUTTON_OUTLINE = `${CARD_BUTTON} border-2 border-white px-3.5`
const CARD_BUTTON_SOLID = `${CARD_BUTTON} ml-auto bg-white px-4`

/**
 * The stack of running and finished timers, bottom right (#611, Phase 1). Each card is a region
 * with its own controls; a finished timer turns orange and announces itself to screen readers.
 * Sizes follow the handoff: a 340 px card, the buttons on one row with "Zakończ" pushed right.
 */
export function TimerCards() {
  const { timers, now, pause, resume, extend, end } = useTimers()
  if (timers.length === 0) return null

  return (
    <section
      aria-label="Minutniki"
      className="fixed right-4 bottom-4 z-40 flex w-[340px] max-w-[calc(100%-32px)] flex-col gap-2"
    >
      {timers.map((timer) => {
        const ended = hasEnded(timer, now)
        const running = isRunning(timer)
        const title = ended ? `Czas minął: ${timer.name}` : timer.name
        return (
          <div
            key={timer.id}
            role={ended ? 'status' : undefined}
            className={`flex flex-col gap-2.5 rounded-tile py-3.5 pr-3.5 pl-4.5 text-white shadow-lg ${
              ended ? 'bg-[#c2410c]' : 'bg-[#111827]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-[16px] font-bold">
                  {title}
                  {!ended && !running && ' · pauza'}
                </p>
                <p className="text-[15px] text-white/90">{ended && timer.next ? timer.next : timerCaption(timer, '')}</p>
              </div>
              <p className="text-[30px] leading-[1.1] font-extrabold tabular-nums" aria-hidden={ended}>
                {ended ? '00:00' : formatClock(remainingMs(timer, now))}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {!ended && (
                <button
                  type="button"
                  onClick={() => (running ? pause(timer.id) : resume(timer.id))}
                  className={CARD_BUTTON_OUTLINE}
                >
                  {running ? 'Pauza' : 'Wznów'}
                </button>
              )}
              <button type="button" onClick={() => extend(timer.id, timer.addMin)} className={CARD_BUTTON_OUTLINE}>
                +{timer.addMin} min
              </button>
              <button
                type="button"
                onClick={() => end(timer.id)}
                className={`${CARD_BUTTON_SOLID} ${ended ? 'text-[#9a3412]' : 'text-[#111827]'}`}
              >
                {ended ? 'OK' : 'Zakończ'}
              </button>
            </div>
          </div>
        )
      })}
    </section>
  )
}
