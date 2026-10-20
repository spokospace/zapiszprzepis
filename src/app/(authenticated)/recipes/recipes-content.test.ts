import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// #229: „Moje przepisy” renders its cards on the server. A 'use client' here would
// ship every row twice (HTML + props) and the card code to the browser again.
describe('RecipesContent', () => {
  it('is a server component', () => {
    const source = readFileSync(join(__dirname, 'recipes-content.tsx'), 'utf8')
    expect(source).not.toMatch(/^\s*['"]use client['"]/m)
  })

  it('selects only the columns a card shows', async () => {
    const { MY_RECIPE_CARD_COLUMNS } = await import('@/lib/my-recipes')
    expect(MY_RECIPE_CARD_COLUMNS.split(', ').sort()).toEqual(
      ['category', 'description', 'id', 'image_url', 'slug', 'source_author', 'source_type', 'source_url', 'title'],
    )
  })
})

describe('myRecipesHref (#230)', () => {
  it('keeps the filters and adds the page only past the first', async () => {
    const { myRecipesHref } = await import('@/lib/my-recipes')
    expect(myRecipesHref()).toBe('/recipes')
    expect(myRecipesHref('zupy', null, 1)).toBe('/recipes?category=zupy')
    expect(myRecipesHref('zupy', 'kruche', 3)).toBe('/recipes?category=zupy&tag=kruche&strona=3')
  })
})
