'use client' // Error boundaries must be Client Components

import { RouteErrorFallback } from '@/app/components/route-error-fallback'

/**
 * Fallback for an uncaught exception on the search page (E01-S05). Rendered
 * inside the /szukaj layout, so the header and MENU stay usable; the recovery
 * link goes home, which a guest can always open.
 */
export default function SzukajError({
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
      logTag="[szukaj]"
      message="Nie udało się wyszukać przepisów. Spróbuj ponownie albo wróć na stronę główną."
      homeHref="/"
      homeLabel="Strona główna"
    />
  )
}
