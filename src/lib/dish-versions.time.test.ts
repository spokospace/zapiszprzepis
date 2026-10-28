import { describe, it, expect } from 'vitest'
import { versionTimeCompare } from './dish-versions'

const times = (total: number | null, extra: Partial<{ times_estimated: boolean; prep: number; cook: number }> = {}) => ({
  servings: null,
  prep_time_minutes: extra.prep ?? null,
  cook_time_minutes: extra.cook ?? null,
  total_time_minutes: total,
  times_estimated: extra.times_estimated ?? false,
})

describe('versionTimeCompare (handoff 2026-10-28 §6)', () => {
  it('gives the version time and how much longer it takes', () => {
    expect(versionTimeCompare(times(20), times(180))).toEqual({ value: '3 godz', delta: 'o 2 godz 40 min dłużej' })
  })

  it('says how much shorter a quicker version is', () => {
    expect(versionTimeCompare(times(60), times(45))).toEqual({ value: '45 min', delta: 'o 15 min krócej' })
  })

  it('drops a gap under ten minutes', () => {
    expect(versionTimeCompare(times(40), times(45))).toEqual({ value: '45 min', delta: null })
  })

  it('keeps the value but no comparison when the viewed recipe has no time', () => {
    expect(versionTimeCompare(times(null), times(45))).toEqual({ value: '45 min', delta: null })
  })

  it('has nothing to show when the version has no time', () => {
    expect(versionTimeCompare(times(30), times(null))).toEqual({ value: null, delta: null })
  })

  it('marks an estimated time and adds prep and cook when no total is stated', () => {
    expect(versionTimeCompare(times(10), times(null, { prep: 15, cook: 30, times_estimated: true }))).toEqual({
      value: '≈ 45 min',
      delta: 'o 35 min dłużej',
    })
  })
})
