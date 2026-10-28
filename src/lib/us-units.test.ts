import { describe, it, expect } from 'vitest'
import { metricUnits } from '@/lib/us-units'

describe('metricUnits', () => {
  it('converts ounces left in a Polish step, in any case form', () => {
    expect(metricUnits('Wymieszać serek z około 7 uncjami sera provolone.')).toBe('Wymieszać serek z około 200 g sera provolone.')
    expect(metricUnits('Dodać 8 uncji makaronu')).toBe('Dodać 230 g makaronu')
    expect(metricUnits('Add 8 oz. pasta')).toBe('Add 230 g pasta')
  })

  it('converts pounds, with fractions and ranges', () => {
    expect(metricUnits('1 funt mięsa')).toBe('450 g mięsa')
    expect(metricUnits('½ funta makaronu')).toBe('230 g makaronu')
    expect(metricUnits('1 1/2 pounds chicken')).toBe('680 g chicken')
    expect(metricUnits('2-3 lbs ziemniaków')).toBe('910–1350 g ziemniaków')
  })

  it('reads fluid ounces as millilitres, not grams', () => {
    expect(metricUnits('Wlać 8 fl oz bulionu')).toBe('Wlać 235 ml bulionu')
  })

  it('puts an oven setting on the 10 °C marks and keeps a probe temperature exact', () => {
    expect(metricUnits('Piec w 350°F przez 30 minut.')).toBe('Piec w 180°C przez 30 minut.')
    expect(metricUnits('Rozgrzać piekarnik do 400 stopni F.')).toBe('Rozgrzać piekarnik do 200°C.')
    expect(metricUnits('Preheat oven to 425 degrees Fahrenheit')).toBe('Preheat oven to 220°C')
    expect(metricUnits('do temperatury wewnętrznej 165°F')).toBe('do temperatury wewnętrznej 74°C')
    expect(metricUnits('Piec w 375-400°F')).toBe('Piec w 190–200°C')
  })

  it('converts pan sizes and keeps the adjective agreeing', () => {
    expect(metricUnits('Przełożyć do formy 9 x 13 inch.')).toBe('Przełożyć do formy 23 × 33 cm.')
    expect(metricUnits('w 9-calowej formie')).toBe('w 23-centymetrowej formie')
    expect(metricUnits('Pokroić na kawałki 2 cale')).toBe('Pokroić na kawałki 5 cm')
  })

  it('leaves metric text, times and plain numbers alone', () => {
    const step = 'Piec 25–30 minut w 200°C, dodać 2 łyżki oliwy i 450 g mięsa. Podzielić na 4 części.'
    expect(metricUnits(step)).toBe(step)
  })
})
