'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
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
  /**
   * `full`: the labelled button of the recipe page. `photo`: a recipe card's
   * heart, alone in a 48 px white circle on the card's photo, so a list keeps
   * its cards quiet; the labelled button stays on the recipe page.
   */
  size?: 'full' | 'photo'
  /** `photo` only: the recipe's title, so each card's heart has its own accessible name. */
  recipeTitle?: string
}

const COPY = {
  full: { off: 'Dodaj do ulubionych', on: 'W ulubionych · usuń' },
  photo: { off: 'Dodaj do ulubionych', on: 'W ulubionych' },
} as const

// wrap-anywhere + shrink-0 icon: the label wraps at 320 px / A++ instead of
// widening the page (WCAG 1.4.10).
const BASE = 'inline-flex items-center justify-center gap-2 font-bold wrap-anywhere transition-colors'
const SIZE = {
  // no-underline!: a guest gets this as a link to /login, shaped like the button.
  full: `${BASE} min-h-[58px] w-full rounded-field border-[2.5px] border-action px-5 text-[18px] no-underline! sm:w-auto`,
  // The shadow sets the white circle off a light photo; the heart itself carries the contrast.
  photo: 'inline-flex h-12 w-12 items-center justify-center rounded-pill bg-white shadow-md transition-colors',
} as const
const LOOK = {
  full: { off: 'bg-white text-action-text hover:bg-surface-accent', on: 'bg-action text-white hover:bg-action-hover' },
  photo: { off: 'text-ink hover:bg-surface-3', on: 'text-action hover:bg-surface-accent' },
} as const
const ICON = 'h-6 w-6 shrink-0'

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

/** Hides a shown toast after ~5 s (handoff). */
function useToastTimeout(toast: boolean, hide: () => void) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(hide, 5000)
    return () => clearTimeout(timer)
  }, [toast, hide])
}

/** "Dodano do ulubionych · Cofnij" in a region that is always mounted, so screen readers announce it when it fills. */
function FavoriteToast({ show, onUndo }: { show: boolean; onUndo: () => void }) {
  return (
    <div role="status" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center empty:hidden">
      {show && (
        <p className="pointer-events-auto flex items-center gap-3 rounded-field bg-ink px-4 py-2 text-[17px] text-white shadow-lg">
          Dodano do ulubionych ·
          <button type="button" onClick={onUndo} className="min-h-[48px] font-bold underline">
            Cofnij
          </button>
        </p>
      )}
    </div>
  )
}

/**
 * The toast after a guest heart's login, on a page that has no heart for the
 * recipe (the signed-in home: the guest home's card hearts return there).
 */
export function FavoriteAddedNotice({ recipeId }: { recipeId: number }) {
  const [toast, setToast] = useState(false)
  const hide = useCallback(() => setToast(false), [])
  useToastTimeout(toast, hide)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (claimFavoriteAdded(recipeId)) setToast(true)
  }, [recipeId])

  return (
    <FavoriteToast
      show={toast}
      onUndo={() => {
        setToast(false)
        void removeFavorite(recipeId)
      }}
    />
  )
}

/**
 * The heart (E01-S06), never a star: labelled on the recipe page, alone on a
 * card's photo, where its accessible name carries the label and the recipe.
 * Optimistic toggle with a ~5 s "Dodano do ulubionych · Cofnij" toast after
 * adding. A guest gets a link to /login?next={this page}&fav={id}; the favorite
 * is saved as the login completes and the toast shows on the way back.
 */
export function FavoriteButton({
  recipeId,
  initialFavorited,
  isAuthenticated,
  size = 'full',
  recipeTitle,
}: FavoriteButtonProps) {
  const pathname = usePathname()
  const [override, setOverride] = useState<boolean | null>(null)
  const [toast, setToast] = useState(false)
  const [error, setError] = useState(false)
  const [pending, startTransition] = useTransition()
  const favorited = override ?? initialFavorited
  const copy = COPY[size]
  const iconOnly = size === 'photo'
  // An icon alone names itself; the title tells one card's heart from the next.
  const name = (label: string) => (iconOnly ? (recipeTitle ? `${label}: ${recipeTitle}` : label) : undefined)

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

  const hideToast = useCallback(() => setToast(false), [])
  useToastTimeout(toast, hideToast)

  if (!isAuthenticated) {
    return (
      <a
        href={loginPath(pathname, recipeId)}
        // The render knows only the path; return to the page's current query too.
        onClick={(e) => {
          e.currentTarget.href = loginPath(`${window.location.pathname}${window.location.search}`, recipeId)
        }}
        aria-label={name(copy.off)}
        className={`${SIZE[size]} ${LOOK[size].off}`}
      >
        <Heart aria-hidden="true" className={ICON} />
        {!iconOnly && copy.off}
      </a>
    )
  }

  return (
    <div className={iconOnly ? 'flex flex-col items-end gap-2' : 'flex flex-col gap-2'}>
      <button
        type="button"
        aria-pressed={favorited}
        aria-label={name(favorited ? copy.on : copy.off)}
        disabled={pending}
        onClick={() => change(!favorited)}
        className={`${SIZE[size]} ${favorited ? LOOK[size].on : LOOK[size].off} disabled:opacity-70`}
      >
        <Heart aria-hidden="true" className={ICON} fill={favorited ? 'currentColor' : 'none'} />
        {!iconOnly && (favorited ? copy.on : copy.off)}
      </button>
      <FavoriteToast show={toast} onUndo={() => change(false)} />
      {error && (
        // On a photo the message needs its own white ground to stay readable.
        <p
          role="alert"
          className={`text-[16px] font-bold text-danger ${iconOnly ? 'max-w-[220px] rounded-field bg-white px-3 py-2 shadow-md' : ''}`}
        >
          Nie udało się zapisać. Spróbuj ponownie.
        </p>
      )}
    </div>
  )
}
