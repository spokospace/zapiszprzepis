import { describe, it, expect } from 'vitest'
import { detectSourceLanguage, localizeForeignIngredients } from './source-language'

describe('localizeForeignIngredients (#524 follow-up)', () => {
  const SOURCE = '1/2 pound pasta\n⅔ cup grated manchego\n1/2 teaspoon dried basil\n2 tablespoons cilantro\n1 stick butter'
  const alt = (a: string) => localizeForeignIngredients([{ name: 'x', alt: a }], SOURCE)[0].alt

  it('drops a cup the source never stated (a weight the model converted)', () => {
    expect(localizeForeignIngredients([{ name: 'makaron', alt: '1/2 szklanki' }], SOURCE)[0].alt).toBe('')
  })

  it('keeps cups, spoons and sticks the source states, in any fraction form', () => {
    expect(alt('2/3 szklanki')).toBe('2/3 szklanki')
    expect(alt('ok. 2/3 szklanki')).toBe('ok. 2/3 szklanki')
    expect(alt('1/2 łyżeczki')).toBe('1/2 łyżeczki')
    expect(alt('½ łyżeczki')).toBe('½ łyżeczki')
    expect(alt('2 łyżki')).toBe('2 łyżki')
    expect(alt('1 kostka')).toBe('1 kostka')
  })

  it('tells teaspoons from tablespoons', () => {
    expect(alt('2 łyżeczki')).toBe('')
    expect(alt('1/2 łyżki')).toBe('')
  })

  it('leaves measures with no US counterpart alone', () => {
    expect(alt('garść')).toBe('garść')
    expect(alt('2 ząbki')).toBe('2 ząbki')
  })

  it('leaves a source without US measures alone', () => {
    expect(localizeForeignIngredients([{ name: 'Mehl', alt: '2 szklanki' }], '500 g Mehl, 2 Tassen Milch')[0].alt).toBe('2 szklanki')
  })

  it('strips a US lean grade from the name', () => {
    expect(localizeForeignIngredients([{ name: 'mięso mielone z indyka (najlepiej 94% chude)', alt: '' }], SOURCE)[0].name).toBe(
      'mięso mielone z indyka (najlepiej chude)',
    )
    expect(localizeForeignIngredients([{ name: 'mleko 3,2%', alt: '' }], SOURCE)[0].name).toBe('mleko 3,2%')
  })
})

describe('detectSourceLanguage (#524)', () => {
  it('reads a Polish blog as Polish', () => {
    expect(detectSourceLanguage('Szarlotka z kruchym ciastem. Składniki: 300 g mąki pszennej, 200 g masła, 1 łyżka cukru. Jabłka obrać i pokroić w kostkę.')).toBe('pl')
  })

  it('reads an English blog as foreign', () => {
    expect(detectSourceLanguage('Turkey Burgers with Guacamole. 1 pound ground turkey, 1 shallot, finely grated. Place the turkey in a bowl and mix with the spices until combined.')).toBe('foreign')
  })

  it('reads Polish typed without diacritics as Polish', () => {
    expect(detectSourceLanguage('Ciasto z jablkami i cynamonem, pieczone w 180 stopniach do zarumienienia')).toBe('pl')
  })

  it('keeps a Polish page Polish despite English links and markup', () => {
    const text = '<div class="post">https://example.com/recipes/apple-pie-with-the-best-crust</div> Placki ziemniaczane: ziemniaki zetrzeć, dodać jajko, smażyć na złoty kolor.'
    expect(detectSourceLanguage(text)).toBe('pl')
  })

  it('treats empty text as foreign', () => {
    expect(detectSourceLanguage('')).toBe('foreign')
    expect(detectSourceLanguage('<img src="x.jpg">')).toBe('foreign')
  })
})
