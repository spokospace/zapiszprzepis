import { describe, it, expect } from 'vitest'
import { detectSourceLanguage } from './source-language'

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
