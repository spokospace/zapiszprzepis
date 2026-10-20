'use client'

import { useEffect, useRef } from 'react'
import { Keyboard, Mic } from 'lucide-react'

/**
 * „Słucham…” (handoff v8 screen 4, E01-S27): a full screen while the microphone
 * listens, so it is obvious the app is waiting for speech. The heard words appear
 * live; the search runs on its own after a pause. „Przestań słuchać i pisz” keeps
 * what was heard in the field. The circle pulses unless reduced motion is asked for.
 */
export function ListeningScreen({ heard, onStop }: { heard: string; onStop: () => void }) {
  const stopRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    stopRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onStop()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onStop])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="listening-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-white px-6 text-center"
    >
      <span className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-action text-white motion-safe:animate-pulse">
        <Mic aria-hidden="true" className="h-14 w-14" />
      </span>
      <h2 id="listening-title" className="text-[28px] font-bold text-ink">
        Słucham…
      </h2>
      <p role="status" aria-live="polite" className="min-h-[2lh] max-w-md text-[24px] wrap-anywhere text-ink">
        {heard || <span className="text-[19px] text-ink-soft">Powiedz nazwę dania albo składnik.</span>}
      </p>
      <button
        ref={stopRef}
        type="button"
        onClick={onStop}
        className="inline-flex min-h-14 items-center gap-2 rounded-field border-2 border-field bg-white px-5 text-[19px] font-bold text-ink hover:bg-surface-3"
      >
        <Keyboard aria-hidden="true" className="h-6 w-6" />
        Przestań słuchać i pisz
      </button>
    </div>
  )
}
