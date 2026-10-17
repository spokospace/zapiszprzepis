'use client' // Error boundaries must be Client Components

import { RouteErrorFallback } from '@/app/components/route-error-fallback'

/** Fallback for an uncaught exception in any authenticated screen (#135). */
export default function AuthenticatedError({
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
      logTag="[authenticated]"
      message="Nie udało się wyświetlić tej strony. Spróbuj ponownie albo wróć do listy przepisów."
      homeHref="/recipes"
      homeLabel="Wróć do przepisów"
    />
  )
}
