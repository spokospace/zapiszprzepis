import { describe, it, expect } from 'vitest'
import { householdAlt } from '@/lib/household-alt'

describe('householdAlt', () => {
  it('reads cups, spoons and sticks from the start of the source line', () => {
    expect(householdAlt('2 cups grape tomatoes, halved')).toBe('2 szklanki')
    expect(householdAlt('1/4 cup fresh basil leaves, chopped')).toBe('1/4 szklanki')
    expect(householdAlt('1 1/2 teaspoons fresh oregano')).toBe('1 1/2 łyżeczki')
    expect(householdAlt('1 tablespoon olive oil')).toBe('1 łyżka')
    expect(householdAlt('3 tbsp butter')).toBe('3 łyżki')
    expect(householdAlt('5 cups flour')).toBe('5 szklanek')
    expect(householdAlt('1 stick unsalted butter')).toBe('1 kostka')
  })

  it('reads fraction glyphs and decimals', () => {
    expect(householdAlt('½ cup sugar')).toBe('1/2 szklanki')
    expect(householdAlt('1½ cups milk')).toBe('1 1/2 szklanki')
    expect(householdAlt('1.5 cups milk')).toBe('1,5 szklanki')
  })

  it('is null for a range, a weight, a packaged ingredient or a Polish line', () => {
    expect(householdAlt('2-3 tablespoons water')).toBeNull()
    expect(householdAlt('2 to 3 tablespoons water')).toBeNull()
    expect(householdAlt('1 pound ground turkey')).toBeNull()
    expect(householdAlt('2 (14.5 oz) cans diced tomatoes')).toBeNull()
    expect(householdAlt('2 szklanki mąki')).toBeNull()
    expect(householdAlt('')).toBeNull()
  })
})
