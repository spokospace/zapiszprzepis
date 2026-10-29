'use client'

import { Pause, Play, Plus, X } from 'lucide-react'
import { useTimers } from '@/app/components/timer-provider'
import { formatClock, hasEnded, isRunning, remainingMs, timerCaption } from '@/lib/timer-store'

/** Buttons on the timer cards: 44 px tall, a 3 px focus ring (WCAG 2.2 AA, ZASADY_PROJEKTU). */
const CARD_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill px-4 text-[16px] font-bold focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]'
const CARD_BUTTON_OUTLINE = `${CARD_BUTTON} border-2 border-white`

/**
 * The stack of running and finished timers, bottom right (#611, Phase 1). Each card is a region
 * with its own controls; a finished timer turns orange and announces itself to screen readers.
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
            className={`rounded-xl p-4 text-white shadow-lg ${ended ? 'bg-[#c2410c]' : 'bg-[#111827]'}`}
          >
            <p className="text-[16px] font-bold">
              {title}
              {!ended && !running && ' · pauza'}
            </p>
            <p className="text-[15px] text-white/90">{ended && timer.next ? timer.next : timerCaption(timer, '')}</p>
            <p className="my-1 text-[30px] leading-tight font-extrabold tabular-nums" aria-hidden={ended}>
              {ended ? '00:00' : formatClock(remainingMs(timer, now))}
            </p>
            <div className="flex flex-wrap gap-2">
              {!ended && (
                <button
                  type="button"
                  onClick={() => (running ? pause(timer.id) : resume(timer.id))}
                  className={CARD_BUTTON_OUTLINE}
                >
                  {running ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
                  {running ? 'Pauza' : 'Wznów'}
                </button>
              )}
              <button type="button" onClick={() => extend(timer.id, timer.addMin)} className={CARD_BUTTON_OUTLINE}>
                <Plus aria-hidden="true" size={18} />+{timer.addMin} min
              </button>
              {ended ? (
                <button type="button" onClick={() => end(timer.id)} className={`${CARD_BUTTON} bg-white text-[#9a3412]`}>
                  OK
                </button>
              ) : (
                <button type="button" onClick={() => end(timer.id)} className={`${CARD_BUTTON} bg-white text-[#111827]`}>
                  <X aria-hidden="true" size={18} />
                  Zakończ
                </button>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
