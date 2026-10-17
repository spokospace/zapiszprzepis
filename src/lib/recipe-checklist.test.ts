import { describe, it, expect } from 'vitest'
import { EMPTY_CHECKLIST, checklistStorageKey, hasChecked, parseChecklist, toggleChecked } from '@/lib/recipe-checklist'

describe('checklistStorageKey', () => {
  it('scopes the state to one recipe', () => {
    expect(checklistStorageKey(42)).toBe('zp-check:42')
  })
})

describe('parseChecklist', () => {
  it('reads a valid stored state', () => {
    expect(parseChecklist('{"ingredients":[2,0],"steps":[1]}')).toEqual({ ingredients: [0, 2], steps: [1] })
  })

  it('treats missing, malformed or unexpected input as nothing ticked (never throws)', () => {
    expect(parseChecklist(null)).toEqual(EMPTY_CHECKLIST)
    expect(parseChecklist('not json')).toEqual(EMPTY_CHECKLIST)
    expect(parseChecklist('[1,2]')).toEqual({ ingredients: [], steps: [] })
    expect(parseChecklist('null')).toEqual(EMPTY_CHECKLIST)
    expect(parseChecklist('{"ingredients":"0","steps":[-1,1.5,"2",3,3]}')).toEqual({ ingredients: [], steps: [3] })
  })
})

describe('toggleChecked', () => {
  it('ticks and unticks one index without touching the other list', () => {
    const ticked = toggleChecked(EMPTY_CHECKLIST, 'steps', 2)
    expect(ticked).toEqual({ ingredients: [], steps: [2] })
    expect(toggleChecked(ticked, 'steps', 2)).toEqual(EMPTY_CHECKLIST)
    expect(toggleChecked(ticked, 'ingredients', 0)).toEqual({ ingredients: [0], steps: [2] })
  })

  it('keeps indexes sorted', () => {
    expect(toggleChecked({ ingredients: [3], steps: [] }, 'ingredients', 1).ingredients).toEqual([1, 3])
  })
})

describe('hasChecked', () => {
  it('is true when anything is ticked', () => {
    expect(hasChecked(EMPTY_CHECKLIST)).toBe(false)
    expect(hasChecked({ ingredients: [], steps: [0] })).toBe(true)
  })
})
