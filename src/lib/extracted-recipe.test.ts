import { describe, it, expect } from 'vitest'
import { toIngredients, toMinutes } from './extracted-recipe'

describe('toIngredients (#381)', () => {
  it('keeps well-formed ingredients as they are', () => {
    expect(toIngredients([{ name: 'Mąka', amount: '200', unit: 'g', alt: 'ok. 1,5 szklanki', section: 'Ciasto' }])).toEqual([
      { name: 'Mąka', amount: '200', unit: 'g', alt: 'ok. 1,5 szklanki', section: 'Ciasto' },
    ])
  })

  it('keeps a given alt, defaults a missing one to "", and coerces a number like amount (#505)', () => {
    expect(toIngredients([{ name: 'Masło', amount: '150', unit: 'g', alt: '3/4 kostki' }])[0].alt).toBe('3/4 kostki')
    expect(toIngredients([{ name: 'Jajka', amount: '4' }])[0].alt).toBe('')
    expect(toIngredients([{ name: 'Cukier', alt: 2 }])[0].alt).toBe('2') // number → its digits
    expect(toIngredients([{ name: 'Sól', alt: { x: 1 } }])[0].alt).toBe('') // non-stringifiable → ""
  })

  it('keeps a Polish household measure in alt (#524)', () => {
    for (const alt of [
      'ok. 1,5 szklanki', '3/4 kostki', 'do 1/3 szklanki', '2 łyżki', 'pół szklanki', 'garść', 'szczypta', '2 ząbki',
      // Worded quantities and sizes (review of #525): never a note.
      'półtorej szklanki', 'półtora opakowania', 'dwie łyżki', 'jedna szklanka', 'płaska łyżka', 'czubata łyżeczka',
      'duża garść', 'mała szczypta', 'opakowanie', 'puszka', 'około szklanki',
      '1 tabliczka', '1/2 laski wanilii', '2 kieliszki', '1 gałka', '1 słoiczek', '1 porcja', '1 saszetka',
      // How full the stated spoon is (stored production values).
      'płaska', 'czubata',
      // A Polish measure beside a foreign one stays.
      '1 łyżka (ok. 1 oz)',
    ])
      expect(toIngredients([{ name: 'X', amount: '1', unit: 'g', alt }])[0]).toMatchObject({ name: 'X', alt })
  })

  it('drops pounds, ounces and English measures from alt when the metric amount is there (#524)', () => {
    expect(toIngredients([{ name: 'mięso mielone z indyka', amount: '450', unit: 'g', alt: '1 funt' }])[0].alt).toBe('')
    expect(toIngredients([{ name: 'makaron', amount: '225', unit: 'g', alt: '½ funta' }])[0].alt).toBe('')
    expect(toIngredients([{ name: 'ser burrata', amount: '225', unit: 'g', alt: '8 uncji' }])[0].alt).toBe('')
    expect(toIngredients([{ name: 'mąka', amount: '240', unit: 'ml', alt: '1 cup' }])[0].alt).toBe('')
    // No metric amount to fall back on: the source's figure is all there is.
    expect(toIngredients([{ name: 'ser', amount: '', unit: '', alt: '8 oz' }])[0].alt).toBe('8 oz')
  })

  it('takes alt from the household measure the source line states, over the model\'s own', () => {
    expect(toIngredients([{ name: 'pomidorki winogronowe', amount: '475', unit: 'ml', alt: '', source: '2 cups grape tomatoes, halved' }])[0])
      .toMatchObject({ amount: '475', unit: 'ml', alt: '2 szklanki' })
    expect(toIngredients([{ name: 'oregano', amount: '7.5', unit: 'ml', alt: 'ok. 2 łyżeczki', source: '1 1/2 teaspoons fresh oregano' }])[0])
      .toMatchObject({ alt: '1 1/2 łyżeczki' })
    // No stated measure: the model's alt stays.
    expect(toIngredients([{ name: 'kurczak', amount: '450', unit: 'g', alt: '', source: '1 pound chicken' }])[0]).toMatchObject({ alt: '' })
  })

  it('drops an alt that only repeats the amount (#524)', () => {
    expect(toIngredients([{ name: 'pomidorki koktajlowe', amount: '1', unit: 'garść', alt: '1 garść' }])[0].alt).toBe('')
  })

  it('moves a preparation note from alt into the name (#524)', () => {
    expect(toIngredients([{ name: 'szalotka', amount: '1', alt: 'finely grated' }])[0]).toMatchObject({ name: 'szalotka finely grated', alt: '' })
    expect(toIngredients([{ name: 'awokado', amount: '1', alt: 'pokrojone' }])[0]).toMatchObject({ name: 'awokado pokrojone', alt: '' })
    expect(toIngredients([{ name: 'bułki', amount: '4-6', alt: 'do wyboru' }])[0]).toMatchObject({ name: 'bułki do wyboru', alt: '' })
    // A unit stem in a cut is a note, not a measure.
    expect(toIngredients([{ name: 'ser', amount: '100', unit: 'g', alt: 'pokrojony w kostkę' }])[0]).toMatchObject({ name: 'ser pokrojony w kostkę', alt: '' })
    expect(toIngredients([{ name: 'ser', amount: '100', unit: 'g', alt: 'pokrojony w kostkę 2 cm' }])[0].alt).toBe('')
    expect(toIngredients([{ name: 'cukinia', amount: '1', alt: 'pokrojona w plasterki' }])[0].alt).toBe('')
    // Already in the name: not repeated.
    expect(toIngredients([{ name: 'limonka wyciśnięta', amount: '1/2', alt: 'wyciśnięta' }])[0]).toMatchObject({ name: 'limonka wyciśnięta', alt: '' })
  })

  it('drops entries without a non-empty string name', () => {
    const raw = [{ amount: '2' }, { name: '' }, { name: '   ' }, { name: 5 }, null, 'mąka', ['Mąka'], { name: 'Jajka' }]
    expect(toIngredients(raw).map((i) => i.name)).toEqual(['Jajka'])
  })

  it('turns a numeric amount into text and anything else into an empty string', () => {
    expect(toIngredients([{ name: 'Mąka', amount: 200, unit: null, section: { x: 1 } }])).toEqual([
      { name: 'Mąka', amount: '200', unit: '', alt: '', section: '' },
    ])
  })

  it('returns an empty list for anything that is not a list', () => {
    expect(toIngredients(undefined)).toEqual([])
    expect(toIngredients(null)).toEqual([])
    expect(toIngredients({ name: 'Mąka' })).toEqual([])
  })
})

describe('toMinutes (#381)', () => {
  it('keeps a whole number of minutes from 0 to 10000, as a number or a bare numeric string', () => {
    expect(toMinutes(0)).toBe(0)
    expect(toMinutes(45)).toBe(45)
    expect(toMinutes(10_000)).toBe(10_000)
    expect(toMinutes(' 30 ')).toBe(30)
  })

  it('is null for anything the int column cannot take', () => {
    for (const value of ['15-20', 37.5, -5, 10_001, 'około 20', '', NaN, Infinity, true, {}, undefined, null]) {
      expect(toMinutes(value)).toBeNull()
    }
  })
})
