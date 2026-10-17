'use client' // Error boundaries must be Client Components

import './globals.css'
import RootError from './error'

/**
 * Last-resort fallback for an exception in the root layout itself, which
 * app/error.tsx cannot catch (#135). It replaces the root layout, so it renders
 * its own <html>/<body> (classes mirrored from layout.tsx, minus the Geist font
 * variables) and imports the global styles, then shows the same page as
 * app/error.tsx.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full flex flex-col mx-auto w-full max-w-screen-2xl">
        <RootError error={error} retry={retry} />
      </body>
    </html>
  )
}
