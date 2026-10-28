import { describe, it, expect } from 'vitest'
import { parseChecklist } from '@/lib/recipe-checklist'
import { ingredientsResetRaw, stepProgressLabel, toggledStepRaw } from './recipe-checklists'

describe('stepProgressLabel', () => {
  it('counts done steps out of the total', () => {
    expect(stepProgressLabel(0, 9)).toBe('0 z 9 kroków zrobione')
    expect(stepProgressLabel(3, 9)).toBe('3 z 9 kroków zrobione')
    expect(stepProgressLabel(2, 2)).toBe('2 z 2 kroków zrobione')
  })

  it('words a one-step recipe on its own, never "1 z 1 kroków"', () => {
    expect(stepProgressLabel(0, 1)).toBe('Jeden krok do zrobienia')
    expect(stepProgressLabel(1, 1)).toBe('Krok zrobiony')
  })
})

describe('toggledStepRaw', () => {
  it('ticks a step and keeps the ingredient ticks', () => {
    const state = parseChecklist('{"ingredients":[2],"steps":[]}')
    expect(parseChecklist(toggledStepRaw(state, 1))).toEqual({ ingredients: [2], steps: [1] })
  })

  it('unticks a ticked step', () => {
    const state = parseChecklist('{"ingredients":[],"steps":[0,1]}')
    expect(parseChecklist(toggledStepRaw(state, 0))).toEqual({ ingredients: [], steps: [1] })
  })
})

describe('ingredientsResetRaw', () => {
  it('clears the ingredient ticks and keeps the step ticks', () => {
    const state = parseChecklist('{"ingredients":[0,3],"steps":[1]}')
    expect(parseChecklist(ingredientsResetRaw(state))).toEqual({ ingredients: [], steps: [1] })
  })

  it('removes the stored key when no step is ticked', () => {
    expect(ingredientsResetRaw(parseChecklist('{"ingredients":[0],"steps":[]}'))).toBeNull()
  })
})
