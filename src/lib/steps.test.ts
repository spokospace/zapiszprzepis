import { describe, it, expect } from 'vitest'
import { parseSteps } from '@/lib/steps'

// #135 — malformed `steps` jsonb crashed the recipe detail RSC with a 500, which
// also hid the delete button. parseSteps must never throw and must only return
// renderable strings.

describe('parseSteps', () => {
  it('returns an array of strings unchanged', () => {
    expect(parseSteps(['Wymieszaj', 'Piecz 40 min'])).toEqual(['Wymieszaj', 'Piecz 40 min'])
  })

  it('parses a valid JSON-array string', () => {
    expect(parseSteps('["Wymieszaj","Piecz"]')).toEqual(['Wymieszaj', 'Piecz'])
  })

  it('drops non-string and blank entries instead of rendering them', () => {
    expect(parseSteps(['Wymieszaj', { text: 'Piecz 40 min' }, 3, null, '  ', ' Podawaj '])).toEqual([
      'Wymieszaj',
      'Podawaj',
    ])
    expect(parseSteps('["Wymieszaj", {"text": "Piecz"}]')).toEqual(['Wymieszaj'])
  })

  it('returns [] for malformed/unexpected input (never throws)', () => {
    expect(parseSteps({ 1: 'Wymieszaj', 2: 'Piecz' })).toEqual([]) // object, not array
    expect(parseSteps('Wymieszaj i piecz')).toEqual([]) // non-JSON string
    expect(parseSteps('{"1":"Wymieszaj"}')).toEqual([]) // JSON object, not array
    expect(parseSteps('[object Object]')).toEqual([])
    expect(parseSteps(42)).toEqual([])
    expect(parseSteps(null)).toEqual([])
    expect(parseSteps(undefined)).toEqual([])
  })
})
