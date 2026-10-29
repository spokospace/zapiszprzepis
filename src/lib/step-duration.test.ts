import { describe, it, expect } from 'vitest'
import { parseStepDuration } from '@/lib/step-duration'

describe('parseStepDuration', () => {
  it('reads a single duration in minutes', () => {
    expect(parseStepDuration('Wyrośnij ciasto na 30 minut.')).toEqual({ min: 30, addMin: 5 })
    expect(parseStepDuration('Gotuj 2 min.')).toEqual({ min: 2, addMin: 5 })
  })

  it('starts a range at its lower bound and derives addMin from the width', () => {
    expect(parseStepDuration('Piecz 12–15 minut, sprawdź po 12 min.')).toEqual({ min: 12, addMin: 3 })
    expect(parseStepDuration('Smaż 5-6 minut.')).toEqual({ min: 5, addMin: 1 })
    expect(parseStepDuration('Gotuj 10–20 minut.')).toEqual({ min: 10, addMin: 5 })
  })

  it('reads hours', () => {
    expect(parseStepDuration('Duś przez 1 godz.')).toEqual({ min: 60, addMin: 5 })
    expect(parseStepDuration('Odstaw na 2 godziny.')).toEqual({ min: 120, addMin: 5 })
  })

  it('returns null when the step has no duration', () => {
    expect(parseStepDuration('Wymieszaj mąkę z wodą.')).toBeNull()
    expect(parseStepDuration('Powinno minąć około kilka minut.')).toBeNull()
    expect(parseStepDuration('Odstaw na pięć minut.')).toBeNull()
  })

  it('ignores zero and inverted ranges', () => {
    expect(parseStepDuration('Czekaj 0 minut.')).toBeNull()
    expect(parseStepDuration('Czekaj 15–12 minut.')).toBeNull()
  })
})
