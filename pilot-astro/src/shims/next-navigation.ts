// Stands in for next/navigation in the pilot. The pathname is reported as the production path,
// so the real header picks the same variant it shows on /przepis/{slug}.
const toProductionPath = (path: string) => path.replace(/^\/pilot\//, '/przepis/').replace(/\/$/, '') || '/'

export function usePathname(): string {
  if (typeof window !== 'undefined') return toProductionPath(window.location.pathname)
  return (globalThis as { __pilotPath?: string }).__pilotPath ?? '/'
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
}

export function useRouter() {
  const go = (href: string) => window.location.assign(href)
  return { push: go, replace: go, refresh: () => window.location.reload(), back: () => window.history.back(), prefetch: () => {} }
}

export const notFound = () => {
  throw new Error('notFound is not available in the pilot')
}
