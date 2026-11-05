'use client'

import type { ComponentProps } from 'react'
import { useSearchParams } from 'next/navigation'
import { useHydrated } from '@/app/components/ui/use-hydrated'
import { parseListKey } from '@/lib/recipe-list-context'
import { RecipeListBar, RecipeListNav } from './recipe-list-bar'

/**
 * `?from` read in the browser, so the server renders one page for every list. It waits for
 * hydration: a page saved as a file was rendered without the query the reader's URL has.
 */
function useFrom() {
  const from = parseListKey(useSearchParams().get('from') ?? undefined)
  return useHydrated() ? from : null
}

export function RecipeListBarFromUrl(props: Omit<ComponentProps<typeof RecipeListBar>, 'from'>) {
  return <RecipeListBar {...props} from={useFrom()} />
}

export function RecipeListNavFromUrl(props: Omit<ComponentProps<typeof RecipeListNav>, 'from'>) {
  return <RecipeListNav {...props} from={useFrom()} />
}
