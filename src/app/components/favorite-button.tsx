'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { Heart } from 'lucide-react'
import { addFavorite, removeFavorite } from '@/app/favorites/actions'
import { FAVORITE_ADDED_PARAM, parseRecipeId } from '@/lib/favorites'
import { loginPath } from '@/lib/login-redirect'
import { stripSearchParam } from '@/lib/strip-search-param'

interface FavoriteButtonProps {
  recipeId: number
  /** Server truth at render time; the client override layers on top of it. */
  initialFavorited: boolean
  isAuthenticated: boolean
  /** `full`: the recipe page. `compact`: a recipe card's footer. */
  size?: 'full' | 'compact'
}

const COPY = {
  full: { off: 'Dodaj do ulubionych', on: 'W ulubionych · usuń' },
  compact: { off: 'Ulubione', on: 'W ulubionych' },
} as const

const BASE = 'inline-flex items-center justify-center gap-2 rounded-field border-action font-bold transition-colors'
const SIZE = {
  full: `${BASE} min-h-[58px] w-full border-[2.5px] px-5 text-[18px] sm:w-auto`,
  compact: `${BASE} min-h-[48px] w-full border-2 px-3 text-[16px]`,
} as const
const OFF = 'bg-white text-action-text hover:bg-surface-accent'
const ON = 'bg-action text-white hover:bg-action-hover'
const ICON = { full: 'h-6 w-6', compact: 'h-5 w-5' } as const

/**
 * `?fav_added={recipeId}` (set by postLoginPath after a guest heart's login):
 * claim it once. Stripping it at once means a second heart for the same recipe
 * on the page (its effect runs next) no longer sees it.
 */
function claimFavoriteAdded(recipeId: number): boolean {
  const added = parseRecipeId(new URLSearchParams(window.location.search).get(FAVORITE_ADDED_PARAM))
  if (added !== recipeId) return false
  stripSearchParam(FAVORITE_ADDED_PARAM)
  return true
}

/**
 * The labelled heart (E01-S06): never an icon alone, never a star. Optimistic
 * toggle with a ~5 s "Dodano do ulubionych · Cofnij" toast after adding. A guest
 * gets a link to /login?next={this page}&fav={id}; the favorite is saved as the
 * login completes and the toast shows on the way back.
 */
export function FavoriteButton({ recipeId, initialFavorited, isAuthenticated, size = 'full' }: FavoriteButtonProps) {
  const pathname = usePathname()
  const [override, setOverride] = useState<boolean | null>(null)
  const [toast, setToast] = useState(false)
  const [error, setError] = useState(false)
  const [pending, startTransition] = useTransition()
  const favorited = override ?? initialFavorited
  const copy = COPY[size]

  function change(next: boolean) {
    setOverride(next)
    setError(false)
    setToast(false)
    startTransition(async () => {
      const result = next ? await addFavorite(recipeId) : await removeFavorite(recipeId)
      if (!result.ok) {
        setOverride(!next)
        setError(true)
      } else if (next) {
        setToast(true)
      }
    })
  }

  // A one-shot read of the address bar after hydration (the server render cannot see it).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthenticated && claimFavoriteAdded(recipeId)) setToast(true)
  }, [isAuthenticated, recipeId])

  // The toast lives ~5 s (handoff).
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(false), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!isAuthenticated) {
    return (
      <a
        href={loginPath(pathname, recipeId)}
        // The render knows only the path; return to the page's current query too.
        onClick={(e) => {
          e.currentTarget.href = loginPath(`${window.location.pathname}${window.location.search}`, recipeId)
        }}
        className={`${SIZE[size]} ${OFF}`}
      >
        <Heart aria-hidden="true" className={ICON[size]} />
        {copy.off}
      </a>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-pressed={favorited}
        disabled={pending}
        onClick={() => change(!favorited)}
        className={`${SIZE[size]} ${favorited ? ON : OFF} disabled:opacity-70`}
      >
        <Heart aria-hidden="true" className={ICON[size]} fill={favorited ? 'currentColor' : 'none'} />
        {favorited ? copy.on : copy.off}
      </button>
      {/* Always mounted, so screen readers announce the toast when it fills. */}
      <div role="status" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center empty:hidden">
        {toast && (
          <p className="pointer-events-auto flex items-center gap-3 rounded-field bg-ink px-4 py-2 text-[17px] text-white shadow-lg">
            Dodano do ulubionych ·
            <button type="button" onClick={() => change(false)} className="min-h-[48px] font-bold underline">
              Cofnij
            </button>
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[16px] font-bold text-danger">
          Nie udało się zapisać. Spróbuj ponownie.
        </p>
      )}
    </div>
  )
}
