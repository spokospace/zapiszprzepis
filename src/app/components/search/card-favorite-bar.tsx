'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { addFavorite, removeFavorite } from '@/app/favorites/actions'

interface CardFavoriteBarProps {
  recipeId: number
  title: string
  initialFavorited: boolean
  /** Null for a guest: the bar is then a link to log in and come back adding it. */
  loginHref: string | null
}

const BAR =
  'flex min-h-[48px] w-full items-center gap-2 border-t border-border-card px-3 text-[17px] font-bold text-action-text hover:bg-surface-accent'

/**
 * The favorites bar under a search result card (E01-S05, "pasek ulubionych").
 * The same optimistic toggle as the recipe page's FavoriteButton (E01-S06), in a
 * compact form that sits outside the card's link.
 */
export function CardFavoriteBar({ recipeId, title, initialFavorited, loginHref }: CardFavoriteBarProps) {
  const [override, setOverride] = useState<boolean | null>(null)
  const [error, setError] = useState(false)
  const [pending, startTransition] = useTransition()
  const favorited = override ?? initialFavorited

  if (loginHref) {
    return (
      <Link href={loginHref} className={BAR} aria-label={`Dodaj do ulubionych: ${title}`}>
        <Heart aria-hidden="true" className="h-5 w-5" />
        Dodaj do ulubionych
      </Link>
    )
  }

  function toggle() {
    const next = !favorited
    setOverride(next)
    setError(false)
    startTransition(async () => {
      const result = next ? await addFavorite(recipeId) : await removeFavorite(recipeId)
      if (!result.ok) {
        setOverride(!next)
        setError(true)
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={favorited}
        aria-label={`${favorited ? 'W ulubionych' : 'Dodaj do ulubionych'}: ${title}`}
        className={`${BAR} disabled:cursor-wait`}
      >
        <Heart aria-hidden="true" className="h-5 w-5" fill={favorited ? 'currentColor' : 'none'} />
        {favorited ? 'W ulubionych' : 'Dodaj do ulubionych'}
      </button>
      {error && (
        <p role="alert" className="px-3 pb-2 text-[16px] text-danger">
          Nie udało się zapisać. Spróbuj ponownie.
        </p>
      )}
    </div>
  )
}
