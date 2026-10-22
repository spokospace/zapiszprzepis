import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RECIPE_CATEGORIES } from './recipe-categories'
import { categoryOgImagePath } from './category-og'

describe('categoryOgImagePath', () => {
  it('builds a /og/categories/<value>.jpg path', () => {
    expect(categoryOgImagePath('zupy')).toBe('/og/categories/zupy.jpg')
  })

  it('has a committed social card for every recipe category', () => {
    for (const { value } of RECIPE_CATEGORIES) {
      const file = fileURLToPath(new URL(`../../public${categoryOgImagePath(value)}`, import.meta.url))
      expect(existsSync(file), `missing OG image for category "${value}"`).toBe(true)
    }
  })
})
