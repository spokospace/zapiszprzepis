'use client'

import { useEffect, useRef } from 'react'
import type { UsageEvent } from '@/lib/analytics/events'
import { track } from '@/lib/analytics/track'

/**
 * Counts one view per mount. Renders nothing, so a cached guest page keeps its markup and the
 * count stays client-side. The ref guard stops a second effect run (dev Strict Mode) from
 * counting twice.
 */
export function TrackView({ event, subject }: { event: UsageEvent; subject: string }) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    track(event, subject)
  }, [event, subject])
  return null
}
