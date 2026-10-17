import { describe, it, expect } from 'vitest'
import { ADD_RECIPE_HREF, buildMenuModel, recipesNoun } from './app-menu-model'

const keys = (model: ReturnType<typeof buildMenuModel>) => model.mine?.map((e) => e.key)

describe('buildMenuModel', () => {
  it('gives a guest no "Moje" block and no account footer', () => {
    expect(buildMenuModel({ isAuthenticated: false, summary: null })).toEqual({
      mine: null,
      showAccountFooter: false,
    })
  })

  it('shows Moje przepisy, Ulubione and an unlocked Dodaj with counters for full access', () => {
    const model = buildMenuModel({
      isAuthenticated: true,
      summary: { hasFullAccess: true, myRecipesCount: 7, favoritesCount: 3 },
    })
    expect(model.showAccountFooter).toBe(true)
    expect(model.mine).toEqual([
      { key: 'my-recipes', href: '/recipes', label: 'Moje przepisy', count: 7, locked: false },
      { key: 'favorites', href: '/ulubione', label: 'Ulubione', count: 3, locked: false },
      { key: 'add', href: ADD_RECIPE_HREF, label: 'Dodaj przepis', count: null, locked: false },
    ])
  })

  it('hides Moje przepisy and locks Dodaj without full access', () => {
    const model = buildMenuModel({
      isAuthenticated: true,
      summary: { hasFullAccess: false, myRecipesCount: 0, favoritesCount: 2 },
    })
    expect(keys(model)).toEqual(['favorites', 'add'])
    expect(model.mine?.find((e) => e.key === 'add')?.locked).toBe(true)
  })

  it('keeps a zero counter but drops a failed (null) one', () => {
    const model = buildMenuModel({
      isAuthenticated: true,
      summary: { hasFullAccess: true, myRecipesCount: null, favoritesCount: 0 },
    })
    expect(model.mine?.map((e) => e.count)).toEqual([null, 0, null])
  })

  it('falls back to today’s capabilities without counters when the summary was not loaded', () => {
    const model = buildMenuModel({ isAuthenticated: true })
    expect(keys(model)).toEqual(['my-recipes', 'favorites', 'add'])
    expect(model.mine?.every((e) => e.count === null && !e.locked)).toBe(true)
  })
})

describe('recipesNoun', () => {
  it.each([
    [0, 'przepisów'],
    [1, 'przepis'],
    [2, 'przepisy'],
    [4, 'przepisy'],
    [5, 'przepisów'],
    [12, 'przepisów'],
    [14, 'przepisów'],
    [22, 'przepisy'],
    [112, 'przepisów'],
  ])('%i → %s', (count, noun) => {
    expect(recipesNoun(count)).toBe(noun)
  })
})
