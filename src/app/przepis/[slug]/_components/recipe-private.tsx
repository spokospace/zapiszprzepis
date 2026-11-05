'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { buttonClasses } from '@/app/components/ui/button'
import { loadBrowserClient, useBrowserSession } from '@/lib/browser-session'
import { RECIPE_SHARED_MESSAGE } from '@/lib/recipe-delete'
import { getRecipePrivate, NO_RECIPE_PRIVATE, type RecipePrivate } from '@/lib/recipe-private'
import { CookingMode } from './cooking-mode'
import { LockedGallery } from './locked-gallery'
import { RecipeChecklists } from './recipe-checklists'
import { RecipePhotos } from './recipe-photos'

/** `pending`: a reader who may be signed in, whose part of the page has not arrived yet. */
const RecipePrivateContext = createContext<RecipePrivate & { pending: boolean }>({ ...NO_RECIPE_PRIVATE, pending: false })

/**
 * Loads what this page adds for a signed-in reader. The page itself comes from the server
 * without knowing who reads it, so the components below take their private part from here.
 */
export function RecipePrivateProvider({ recipeId, children }: { recipeId: number; children: ReactNode }) {
  const session = useBrowserSession()
  const userId = session.status === 'user' ? session.userId : null
  const key = `${userId}:${recipeId}`
  const [loaded, setLoaded] = useState<{ key: string; data: RecipePrivate } | null>(null)

  useEffect(() => {
    if (!userId) return
    let current = true
    loadBrowserClient()
      .then((supabase) => getRecipePrivate(supabase, userId, recipeId))
      .catch(() => NO_RECIPE_PRIVATE)
      .then((data) => {
        if (current) setLoaded({ key, data })
      })
    return () => {
      current = false
    }
  }, [userId, recipeId, key])

  const data = loaded?.key === key ? loaded.data : NO_RECIPE_PRIVATE
  const pending = session.status === 'unknown' || (userId !== null && loaded?.key !== key)
  const value = useMemo(() => ({ ...data, pending }), [data, pending])
  return <RecipePrivateContext.Provider value={value}>{children}</RecipePrivateContext.Provider>
}

export function PrivateRecipePhotos({ galleryCount, ...props }: Omit<ComponentProps<typeof RecipePhotos>, 'images' | 'reserveThumbnails'> & { galleryCount: number }) {
  const { galleryImages, pending } = useContext(RecipePrivateContext)
  return <RecipePhotos {...props} images={galleryImages} reserveThumbnails={pending && galleryCount > 1} />
}

export function PrivateCookingMode(props: Omit<ComponentProps<typeof CookingMode>, 'stepImages'>) {
  return <CookingMode {...props} stepImages={useContext(RecipePrivateContext).stepImages} />
}

export function PrivateRecipeChecklists(props: Omit<ComponentProps<typeof RecipeChecklists>, 'stepImages'>) {
  return <RecipeChecklists {...props} stepImages={useContext(RecipePrivateContext).stepImages} />
}

/** A guest's teaser in place of the gallery (E01-S07); hidden, with its space kept, until the session is known. */
export function GuestGallery(props: ComponentProps<typeof LockedGallery>) {
  const session = useBrowserSession()
  if (session.status === 'user') return null
  return (
    <div className={`print:hidden ${session.status === 'unknown' ? 'session-pending' : ''}`}>
      <LockedGallery {...props} />
    </div>
  )
}

/** "Odśwież przepis" and "Usuń przepis", plain forms to API routes, so they need no Server Action. */
export function OwnerActions({ slug }: { slug: string }) {
  const { isOwner } = useContext(RecipePrivateContext)
  const deleteRefused = useSearchParams().get('delete_error') === 'shared'
  if (!isOwner) return null
  return (
    <>
      {deleteRefused && (
        <p role="alert" className="mb-4 border-t border-border-card pt-8 text-[17px] font-bold text-danger print:hidden">
          {RECIPE_SHARED_MESSAGE}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-card pt-8 print:hidden">
        <form action="/api/recipes/refresh" method="POST">
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" className={buttonClasses('outline', 'md')}>
            Odśwież przepis
          </button>
        </form>
        <form action="/api/recipes/delete" method="POST">
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" className={buttonClasses('danger', 'md')}>
            Usuń przepis
          </button>
        </form>
      </div>
    </>
  )
}
