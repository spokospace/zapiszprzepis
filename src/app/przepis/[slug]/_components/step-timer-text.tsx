'use client'

import { Timer } from 'lucide-react'
import { useTimers } from '@/app/components/timer-provider'
import { formatClock, hasEnded, isRunning, remainingMs } from '@/lib/timer-store'
import { locateStepDuration } from '@/lib/step-duration'

/**
 * A recipe step's text with its duration turned into a timer button (#611, Phase 1). The button
 * looks like a link (handoff: 800 weight, #9a3412, underlined). A step with a running timer shows
 * the time left instead; a second tap does nothing, so the timer cannot be started twice.
 */
export function StepTimerText({
  text,
  stepNumber,
  recipeSlug,
  recipeTitle,
}: {
  text: string
  /** 1-based, as shown to the reader ("Krok 3"). */
  stepNumber: number
  recipeSlug: string
  recipeTitle: string
}) {
  const { timers, now, start } = useTimers()
  const located = locateStepDuration(text)
  if (!located) return <>{text}</>

  const { duration, text: durationText, index } = located
  const name = `Krok ${stepNumber}`
  const timer = timers.find((t) => t.recipeSlug === recipeSlug && t.step === stepNumber)
  const before = text.slice(0, index)
  const after = text.slice(index + durationText.length)

  let label = `Włącz minutnik: ${name}, ${duration.min} min`
  let status: string | null = null
  if (timer) {
    const left = formatClock(remainingMs(timer, now))
    if (hasEnded(timer, now)) {
      status = 'czas minął'
      label = `Minutnik ${name}: czas minął`
    } else if (isRunning(timer)) {
      status = left
      label = `Minutnik ${name} działa, zostało ${left}`
    } else {
      status = `pauza ${left}`
      label = `Minutnik ${name} jest zatrzymany, zostało ${left}`
    }
  }

  return (
    <>
      {before}
      <button
        type="button"
        aria-label={label}
        aria-disabled={timer ? true : undefined}
        onClick={() => {
          if (!timer) start({ name, recipeSlug, recipeTitle, step: stepNumber, next: null, addMin: duration.addMin }, duration.min)
        }}
        className={`-my-2.5 mx-0 inline-flex items-center gap-1 px-0.5 py-2.5 font-extrabold underline decoration-2 underline-offset-4 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8] ${
          timer ? 'text-[#15803d]' : 'text-[#9a3412]'
        }`}
      >
        <Timer aria-hidden="true" size={18} />
        {durationText}
      </button>
      {status && (
        <span aria-hidden="true" className="ml-1.5 rounded-md bg-[#dcfce7] px-1.5 py-0.5 text-[15px] font-bold tabular-nums text-[#14532d]">
          {status}
        </span>
      )}
      {after}
    </>
  )
}
