'use client'

import type { ComponentProps } from 'react'
import { useSearchParams } from 'next/navigation'
import { parseListKey } from '@/lib/recipe-list-context'
import { RecipeListBar, RecipeListNav } from './recipe-list-bar'

/** `?from` read in the browser, so the server renders one page for every list. */
function useFrom() {
  return parseListKey(useSearchParams().get('from') ?? undefined)
}

export function RecipeListBarFromUrl(props: Omit<ComponentProps<typeof RecipeListBar>, 'from'>) {
  return <RecipeListBar {...props} from={useFrom()} />
}

export function RecipeListNavFromUrl(props: Omit<ComponentProps<typeof RecipeListNav>, 'from'>) {
  return <RecipeListNav {...props} from={useFrom()} />
}
