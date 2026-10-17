'use client' // Error boundaries must be Client Components

import { RouteErrorFallback } from '@/app/components/route-error-fallback'

/**
 * Fallback for an uncaught exception on a public category listing (E01-S09).
 * Rendered inside the /przepisy layout, so the header and MENU stay usable; the
 * recovery link goes home, never to an owner-only page a guest can't open.
 */
export default function PrzepisyError({
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
      logTag="[przepisy]"
      message="Nie udało się wyświetlić przepisów z tej kategorii. Spróbuj ponownie albo wróć na stronę główną."
      homeHref="/"
      homeLabel="Strona główna"
    />
  )
}
