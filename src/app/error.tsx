'use client' // Error boundaries must be Client Components

import { RouteErrorFallback } from '@/app/components/route-error-fallback'

/**
 * Fallback for an uncaught exception on any page without its own boundary
 * (login, signup, share, favorites, password reset…), so it degrades to a
 * recoverable page instead of the bare Next.js 500 (#135). Links home: the
 * visitor may be a guest, and "/recipes" is owner-only.
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <RouteErrorFallback
      error={error}
      retry={retry}
      logTag="[root]"
      message="Nie udało się wyświetlić tej strony. Spróbuj ponownie albo wróć na stronę główną."
      homeHref="/"
      homeLabel="Strona główna"
    />
  )
}
