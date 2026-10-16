'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { addFavorite, removeFavorite } from '@/app/favorites/actions'

interface FavoriteButtonProps {
  recipeId: number
  /** Server truth at render time; the client override layers on top of it. */
  initialFavorited: boolean
  isAuthenticated: boolean
  /** Where a guest goes: /login with a `next` that returns here asking to add. */
  loginHref: string
  /** The page was reached with ?fav=1 after logging in: add once, then drop the param. */
  autoAdd: boolean
}

const BASE =
  'inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-field px-5 text-[18px] font-bold transition-colors sm:w-auto'
const OFF = `${BASE} border-[2.5px] border-action bg-white text-action-text hover:bg-surface-accent`
const ON = `${BASE} border-[2.5px] border-action bg-action text-white hover:bg-action-hover`

/**
 * "Dodaj do ulubionych" / "W ulubionych · usuń" (E01-S06, handoff recipe page).
 * Optimistic toggle with a 5 s "Cofnij" toast after adding. A guest gets a link
 * to /login that brings them back and adds the favorite there.
 */
export function FavoriteButton({ recipeId, initialFavorited, isAuthenticated, loginHref, autoAdd }: FavoriteButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [override, setOverride] = useState<boolean | null>(null)
  const [toast, setToast] = useState(false)
  const [error, setError] = useState(false)
  const [pending, startTransition] = useTransition()
  const autoAddRan = useRef(false)
  const favorited = override ?? initialFavorited

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

  // After login with ?fav=1: add once (a POST through the server action, never a
  // GET side effect), then drop the param so a reload does not repeat it.
  useEffect(() => {
    if (!autoAdd || autoAddRan.current) return
    autoAddRan.current = true
    void (async () => {
      if (!initialFavorited) {
        const result = await addFavorite(recipeId)
        if (result.ok) setToast(true)
        else setError(true)
      }
      router.replace(pathname, { scroll: false })
    })()
  }, [autoAdd, initialFavorited, pathname, recipeId, router])

  // The toast lives ~5 s (handoff).
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(false), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!isAuthenticated) {
    return (
      <Link href={loginHref} className={OFF}>
        <Heart aria-hidden="true" className="h-6 w-6" />
        Dodaj do ulubionych
      </Link>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-pressed={favorited}
        disabled={pending}
        onClick={() => change(!favorited)}
        className={`${favorited ? ON : OFF} disabled:opacity-70`}
      >
        <Heart aria-hidden="true" className="h-6 w-6" fill={favorited ? 'currentColor' : 'none'} />
        {favorited ? 'W ulubionych · usuń' : 'Dodaj do ulubionych'}
      </button>
      {toast && (
        <p role="status" className="flex items-center gap-3 rounded-field bg-ink px-4 py-3 text-[17px] text-white">
          Dodano do ulubionych ·
          <button type="button" onClick={() => change(false)} className="min-h-[48px] font-bold underline">
            Cofnij
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-[17px] font-bold text-danger">
          Nie udało się zapisać. Spróbuj ponownie.
        </p>
      )}
    </div>
  )
}
