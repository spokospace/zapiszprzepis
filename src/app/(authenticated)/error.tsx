'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Fallback for an uncaught exception in any authenticated screen, so it
 * degrades to a recoverable page instead of the bare Next.js 500 (#135).
 * The header from the layout stays visible above it.
 */
export default function AuthenticatedError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[authenticated] Render error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Coś poszło nie tak</h1>
        <p className="text-gray-600 mb-8">
          Nie udało się wyświetlić tej strony. Spróbuj ponownie albo wróć do listy przepisów.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition text-sm font-medium"
          >
            Spróbuj ponownie
          </button>
          <Link
            href="/recipes"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
          >
            Wróć do przepisów
          </Link>
        </div>
      </div>
    </div>
  )
}
