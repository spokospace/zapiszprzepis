import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { FavoriteButton } from '@/app/components/favorite-button'
import { PrintButton } from './print-button'
import { RecipeActions } from './recipe-actions'

vi.mock('@/app/favorites/actions', () => ({ addFavorite: vi.fn(), removeFavorite: vi.fn() }))

/** Every element of the given component type in a rendered tree. */
function find(node: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) node.forEach((n) => find(n, type, out))
  else if (node && typeof node === 'object' && 'props' in node) {
    const el = node as ReactElement<{ children?: unknown }>
    if (el.type === type) out.push(el)
    find(el.props.children, type, out)
  }
  return out
}

describe('RecipeActions usage-count slug', () => {
  const tree = RecipeActions({
    recipeId: 7,
    recipeSlug: 'zupa-krem',
    isFavorite: false,
    isAuthenticated: true,
    title: 'Zupa krem',
    shareUrl: 'https://zapiszprzepis.pl/przepis/zupa-krem',
    steps: ['a'],
    stepImages: [''],
  })

  it('passes the slug to the favorite and print buttons', () => {
    expect((find(tree, FavoriteButton)[0].props as { recipeSlug: string }).recipeSlug).toBe('zupa-krem')
    expect((find(tree, PrintButton)[0].props as { recipeSlug: string }).recipeSlug).toBe('zupa-krem')
  })
})
