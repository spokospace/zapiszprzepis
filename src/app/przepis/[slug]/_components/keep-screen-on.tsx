'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createScreenWakeLock } from '@/lib/wake-lock'

const noSubscribe = () => () => {}

/**
 * „Nie wygaszaj ekranu” (#611, Phase 1): keeps the screen awake while this page is open. The
 * controller from lib/wake-lock.ts takes the lock again after the tab is shown again. Renders
 * nothing where the Wake Lock API is missing.
 */
export function KeepScreenOn() {
  // Server render and first client render both say "unsupported", so the switch never flashes.
  const supported = useSyncExternalStore(noSubscribe, () => 'wakeLock' in navigator, () => false)
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (!on || !supported) return
    const lock = createScreenWakeLock({ navigator, document })
    // A refused request (battery saver, no user activation) resolves to false; the switch goes off.
    void lock.acquire().then((held) => {
      if (!held) setOn(false)
    })
    return () => void lock.release()
  }, [on, supported])

  if (!supported) return null

  return (
    <div className="flex min-h-12 items-center gap-3 text-[16px] font-bold text-ink print:hidden">
      <span id="keep-screen-on-label">Nie wygaszaj ekranu</span>
      <button
        type="button"
        role="switch"
        aria-labelledby="keep-screen-on-label"
        aria-checked={on}
        onClick={() => setOn((value) => !value)}
        className={`relative inline-flex h-[26px] w-11 shrink-0 items-center rounded-pill transition-colors ${
          on ? 'bg-success' : 'bg-ink-muted'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-[3px]'}`}
        />
      </button>
    </div>
  )
}
