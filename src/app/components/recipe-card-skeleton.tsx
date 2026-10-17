import type { ReactNode } from 'react'

/** A grey placeholder bar; size and shape come from `className`. */
export function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-gray-200 ${className}`} />
}

/**
 * The one line a loading screen says to screen readers. The skeleton around it is
 * aria-hidden, so this is all assistive tech hears while the page renders.
 */
export function LoadingStatus({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  )
}

/** RecipeCard's shape (border, 4:3 image box, title, note, category and source row) with no content. */
function RecipeCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="aspect-[4/3] bg-gray-100" />
      <div className="p-4">
        <SkeletonBar className="h-5 w-3/4" />
        <SkeletonBar className="mt-2 h-4 w-1/2" />
        <div className="mt-3 flex items-center justify-between gap-2">
          <SkeletonBar className="h-6 w-20 rounded-full" />
          <SkeletonBar className="h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

/**
 * A grid of card placeholders for the loading.tsx of a recipe list (#227). Pass the
 * list's own grid classes so the real cards land where the placeholders were.
 */
export function RecipeGridSkeleton({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <RecipeCardSkeleton key={i} />
      ))}
    </div>
  )
}
