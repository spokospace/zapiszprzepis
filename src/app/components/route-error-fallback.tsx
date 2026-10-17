'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button, buttonClasses } from './ui/button'

/**
 * The recoverable page an `error.tsx` boundary renders instead of the bare
 * Next.js 500 (#135); the layout's header stays visible above it. `retry` is
 * Next's own: it refreshes the server data and then resets the boundary, which
 * is what a server-render error needs (`reset` alone would re-render the same
 * failing payload).
 */
export function RouteErrorFallback({
  error,
  retry,
  logTag,
  message,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string }
  retry: () => void
  /** Console prefix, e.g. "[przepis]". */
  logTag: string
  message: string
  homeHref: string
  homeLabel: string
}) {
  useEffect(() => {
    console.error(`${logTag} Render error:`, error)
  }, [logTag, error])

  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold text-ink mb-3">Coś poszło nie tak</h1>
        <p className="text-ink-soft mb-8">{message}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="md" onClick={() => retry()}>
            Spróbuj ponownie
          </Button>
          <Link href={homeHref} className={buttonClasses('outline', 'md')}>
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
