'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { returnPointFor, RETURN_POINT_KEY, serializeReturnPoint } from '@/lib/return-point'
import { writeSessionStorage } from './ui/use-session-storage'

/**
 * Renders nothing; remembers the last list-like screen in this tab's sessionStorage so
 * a recipe page's „← Wróć” can lead back to it (handoff 13, §3). Recipe pages and other
 * screens leave the stored point alone. Mounted in the header, inside Suspense, because
 * useSearchParams needs a boundary.
 */
export function ReturnPointRecorder() {
  const pathname = usePathname()
  const search = useSearchParams().toString()

  useEffect(() => {
    const point = returnPointFor(pathname, search)
    if (point) writeSessionStorage(RETURN_POINT_KEY, serializeReturnPoint(point))
  }, [pathname, search])

  return null
}
