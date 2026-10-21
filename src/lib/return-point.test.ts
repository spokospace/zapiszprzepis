import { describe, it, expect } from 'vitest'
import {
  HOME_RETURN_POINT,
  parseReturnPoint,
  resolveRecipeBackTarget,
  returnPointFor,
  serializeReturnPoint,
} from './return-point'

describe('returnPointFor', () => {
  it('names the start page, a category, Ulubione, Moje przepisy and search results', () => {
    expect(returnPointFor('/', '')).toEqual({ href: '/', label: 'Strona główna' })
    expect(returnPointFor('/przepisy/desery', '')).toEqual({ href: '/przepisy/desery', label: 'Desery' })
    expect(returnPointFor('/ulubione', '')).toEqual({ href: '/ulubione', label: 'Ulubione' })
    expect(returnPointFor('/recipes', '')).toEqual({ href: '/recipes', label: 'Moje przepisy' })
    expect(returnPointFor('/szukaj', 'q=dynia')).toEqual({ href: '/szukaj?q=dynia', label: 'Wyniki' })
  })

  it('keeps the query string, with or without the leading "?"', () => {
    expect(returnPointFor('/przepisy/desery', '?tags=kruche')?.href).toBe('/przepisy/desery?tags=kruche')
    expect(returnPointFor('/przepisy/desery', 'tags=kruche')?.href).toBe('/przepisy/desery?tags=kruche')
  })

  it('records nothing for recipes, the empty search screen, unknown categories or other pages', () => {
    expect(returnPointFor('/przepis/sernik', '')).toBeNull()
    expect(returnPointFor('/szukaj', '')).toBeNull()
    expect(returnPointFor('/szukaj', 'q=%20')).toBeNull()
    expect(returnPointFor('/przepisy/nie-ma-takiej', '')).toBeNull()
    expect(returnPointFor('/settings', '')).toBeNull()
    expect(returnPointFor('/powiadomienia', '')).toBeNull()
  })
})

describe('parseReturnPoint', () => {
  it('round-trips a stored point', () => {
    const point = { href: '/ulubione', label: 'Ulubione' }
    expect(parseReturnPoint(serializeReturnPoint(point))).toEqual(point)
  })

  it('rejects junk and anything that is not a path on this site', () => {
    expect(parseReturnPoint(null)).toBeNull()
    expect(parseReturnPoint('nie json')).toBeNull()
    expect(parseReturnPoint('{"href":"/x"}')).toBeNull()
    expect(parseReturnPoint('{"href":"https://evil.example","label":"Strona"}')).toBeNull()
    expect(parseReturnPoint('{"href":"//evil.example","label":"Strona"}')).toBeNull()
    expect(parseReturnPoint('{"href":"/x","label":""}')).toBeNull()
  })
})

describe('resolveRecipeBackTarget', () => {
  const recorded = { href: '/przepisy/desery', label: 'Desery' }
  const fromList = { href: '/przepisy/zupy', label: 'Zupy' }

  it('is the plain „Wróć” (null) off a recipe page and before hydration', () => {
    expect(resolveRecipeBackTarget({ onRecipe: false, hydrated: true, returnPoint: recorded, listTarget: null })).toBeNull()
    expect(resolveRecipeBackTarget({ onRecipe: true, hydrated: false, returnPoint: recorded, listTarget: null })).toBeNull()
  })

  it('prefers the recorded point, then the list the recipe came from, then the start page', () => {
    expect(resolveRecipeBackTarget({ onRecipe: true, hydrated: true, returnPoint: recorded, listTarget: fromList })).toEqual(recorded)
    expect(resolveRecipeBackTarget({ onRecipe: true, hydrated: true, returnPoint: null, listTarget: fromList })).toEqual(fromList)
    expect(resolveRecipeBackTarget({ onRecipe: true, hydrated: true, returnPoint: null, listTarget: null })).toEqual(HOME_RETURN_POINT)
  })
})
