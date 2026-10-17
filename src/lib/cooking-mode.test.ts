import { describe, it, expect } from 'vitest'
import {
  MAX_PROGRESS_SEGMENTS,
  clampStep,
  isLastStep,
  progressRatio,
  progressSegments,
  stepLabel,
} from '@/lib/cooking-mode'

describe('clampStep', () => {
  it('keeps the index inside the recipe', () => {
    expect(clampStep(2, 5)).toBe(2)
    expect(clampStep(-1, 5)).toBe(0)
    expect(clampStep(9, 5)).toBe(4)
    expect(clampStep(1.7, 5)).toBe(1)
  })

  it('returns 0 for no steps or a non-number', () => {
    expect(clampStep(3, 0)).toBe(0)
    expect(clampStep(Number.NaN, 5)).toBe(0)
    expect(clampStep(Number.POSITIVE_INFINITY, 5)).toBe(0)
  })
})

describe('stepLabel', () => {
  it('reads "Krok N z M" from a 0-based index', () => {
    expect(stepLabel(0, 7)).toBe('Krok 1 z 7')
    expect(stepLabel(6, 7)).toBe('Krok 7 z 7')
    expect(stepLabel(10, 7)).toBe('Krok 7 z 7')
  })
})

describe('isLastStep', () => {
  it('is true only on the final step (and for a single step)', () => {
    expect(isLastStep(0, 3)).toBe(false)
    expect(isLastStep(2, 3)).toBe(true)
    expect(isLastStep(0, 1)).toBe(true)
  })
})

describe('progressSegments', () => {
  it('marks done, current and to-do steps', () => {
    expect(progressSegments(2, 5)).toEqual(['done', 'done', 'current', 'todo', 'todo'])
  })

  it('has one current segment for a one-step recipe', () => {
    expect(progressSegments(0, 1)).toEqual(['current'])
  })

  it('clamps an out-of-range index', () => {
    expect(progressSegments(99, 3)).toEqual(['done', 'done', 'current'])
    expect(progressSegments(-4, 2)).toEqual(['current', 'todo'])
  })

  it('switches to a single fill past the segment limit', () => {
    expect(progressSegments(0, MAX_PROGRESS_SEGMENTS)).toHaveLength(MAX_PROGRESS_SEGMENTS)
    expect(progressSegments(0, MAX_PROGRESS_SEGMENTS + 1)).toBeNull()
  })
})

describe('progressRatio', () => {
  it('counts the current step as reached', () => {
    expect(progressRatio(0, 4)).toBe(0.25)
    expect(progressRatio(3, 4)).toBe(1)
    expect(progressRatio(0, 0)).toBe(0)
  })
})
