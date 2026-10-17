'use client' // Error boundaries must be Client Components

import { RouteErrorFallback } from '@/app/components/route-error-fallback'

/**
 * Fallback for an uncaught exception on the public recipe page (E01-S03b). The
 * recovery link goes home, not to "/recipes" (owner-only), so a guest is not
 * bounced to /login.
 */
export default function PrzepisError({
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
      logTag="[przepis]"
      message="Nie udało się wyświetlić tego przepisu. Spróbuj ponownie albo wróć na stronę główną."
      homeHref="/"
      homeLabel="Strona główna"
    />
  )
}
