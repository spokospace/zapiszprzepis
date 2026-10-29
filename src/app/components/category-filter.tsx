'use client'

import { useOptimistic } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  LoaderCircle,
  Utensils,
  Soup,
  CakeSlice,
  Cake,
  Cookie,
  Coffee,
  Croissant,
  Sandwich,
  Salad,
  GlassWater,
  Amphora,
  FlaskRound,
  UtensilsCrossed,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { RECIPE_CATEGORIES, type RecipeCategory } from '@/lib/recipe-categories'
import { useListTransition } from './list-transition'

const CATEGORY_ICONS: Record<RecipeCategory, LucideIcon> = {
  obiady: Utensils,
  zupy: Soup,
  desery: CakeSlice,
  ciasta: Cake,
  ciasteczka: Cookie,
  sniadania: Coffee,
  pieczywo: Croissant,
  przekaski: Sandwich,
  salatki: Salad,
  napoje: GlassWater,
  przetwory: Amphora,
  syropy: FlaskRound,
  inne: UtensilsCrossed,
}

interface CategoryFilterProps {
  activeCategory?: string | null
  counts?: Partial<Record<RecipeCategory, number>>
}

export function CategoryFilter({ activeCategory, counts }: CategoryFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { startTransition } = useListTransition()
  // While the list reloads, the tapped chip already shows as selected and spins;
  // both fall back to the URL's category once the navigation has finished.
  const [optimistic, setOptimistic] = useOptimistic({
    active: activeCategory ?? null,
    tapped: null as RecipeCategory | null,
  })

  function handleClick(value: RecipeCategory) {
    const next = optimistic.active === value ? null : value
    const params = new URLSearchParams(searchParams.toString())
    // Another category starts from the first page of „Pokaż kolejne” (#230).
    params.delete('strona')
    if (next) {
      params.set('category', next)
    } else {
      params.delete('category')
    }
    startTransition(() => {
      setOptimistic({ active: next, tapped: value })
      router.push(`/recipes?${params.toString()}`)
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {RECIPE_CATEGORIES.map(({ value, label }) => {
        const Icon = optimistic.tapped === value ? LoaderCircle : CATEGORY_ICONS[value]
        const isActive = optimistic.active === value
        const count = counts?.[value]
        return (
          <button
            key={value}
            aria-pressed={isActive}
            onClick={() => handleClick(value)}
            className={`inline-flex min-h-[48px] items-center gap-1.5 px-3 py-1.5 rounded-full text-base font-medium transition-colors ${
              isActive
                ? 'bg-action text-white'
                : 'bg-surface-accent text-action-text hover:bg-surface-accent-2'
            }`}
          >
            <Icon
              aria-hidden="true"
              size={17}
              strokeWidth={1.75}
              className={optimistic.tapped === value ? 'motion-safe:animate-spin' : undefined}
            />
            <span>{label}</span>
            {count !== undefined && (
              <span className={`ml-0.5 text-xs ${isActive ? 'text-orange-100' : 'text-orange-500'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

