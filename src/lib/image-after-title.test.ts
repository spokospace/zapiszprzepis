import { describe, expect, it } from 'vitest'
import { imageAfterTitle } from './recipe-image-archive'

const SALAD = 'Салата з цёртай рэдзькі з яйкам'
const FRIED = 'Смажанікі (смажанікі з каўбасой)'
const POTATO = 'Смажанікі з бульбы з падлівай'

// The shape of slushna.by/belaruskaya-kuxnya-recepty-i-sakrety/: a Belarusian
// page, a lead-in that names the dishes, a heading per dish, and a third dish
// that has no heading, only a photo whose alt text names it.
const PAGE = `
<h2>Душа беларускай кухні</h2>
<p><img src="https://cdn.test/lead.jpg" alt="Беларуская кухня"></p>
<ul><li>${SALAD}</li><li>${FRIED}</li></ul>
<h2>${SALAD}</h2>
<p><img loading="lazy" class="aligncenter" src="https://cdn.test/salata.jpg" alt="Такая карысная рэдзька"></p>
<h2>${FRIED}</h2>
<p><img class="aligncenter" src="https://cdn.test/smazaniki.jpg" alt="${FRIED}"></p>
<p>Рэцэпт смажанікаў.</p>
<p><img class="aligncenter" src="https://cdn.test/bulba.jpg" alt="${POTATO}"></p>
<p><img class="aligncenter" src="https://cdn.test/kaubasa.jpg" alt="Вясковая каўбаса"></p>`

const NAMES = [SALAD, FRIED, POTATO]
const others = (own: string) => NAMES.filter((name) => name !== own)

describe('imageAfterTitle', () => {
  it('takes the photo after a dish heading, in the page language', () => {
    expect(imageAfterTitle([SALAD], PAGE, others(SALAD))).toBe('https://cdn.test/salata.jpg')
    expect(imageAfterTitle([FRIED], PAGE, others(FRIED))).toBe('https://cdn.test/smazaniki.jpg')
  })

  it('starts at the photo when the dish is named only in its alt text', () => {
    expect(imageAfterTitle([POTATO], PAGE, others(POTATO))).toBe('https://cdn.test/bulba.jpg')
  })

  it('skips a mention with no photo after it, such as a lead-in list', () => {
    const page = `<p>${SALAD}, ${FRIED}</p><h2>${SALAD}</h2><img src="https://cdn.test/salata.jpg"><h2>${FRIED}</h2><img src="https://cdn.test/smazaniki.jpg">`
    expect(imageAfterTitle([SALAD], page, [FRIED])).toBe('https://cdn.test/salata.jpg')
    expect(imageAfterTitle([FRIED], page, [SALAD])).toBe('https://cdn.test/smazaniki.jpg')
  })

  it('stops at the next dish, so a dish without a photo does not take its neighbour’s', () => {
    const page = `<h2>${SALAD}</h2><p>Bez zdjęcia.</p><h2>${FRIED}</h2><img src="https://cdn.test/smazaniki.jpg">`
    expect(imageAfterTitle([SALAD], page, [FRIED])).toBeUndefined()
  })

  it('tries the dish names in order, so a translated title falls back to the page’s own', () => {
    const polish = 'Sałatka z tartej rzodkwi z jajkiem'
    expect(imageAfterTitle([polish], PAGE, others(SALAD))).toBeUndefined()
    expect(imageAfterTitle([polish, SALAD], PAGE, others(SALAD))).toBe('https://cdn.test/salata.jpg')
  })

  it('reads markdown images, including a name in the alt text', () => {
    const page = `## Sernik\n\n![Sernik](https://cdn.test/sernik.jpg)\n\n![Szarlotka na kruchym cieście](https://cdn.test/szarlotka.jpg)`
    expect(imageAfterTitle(['Sernik'], page, ['Szarlotka na kruchym cieście'])).toBe('https://cdn.test/sernik.jpg')
    expect(imageAfterTitle(['Szarlotka na kruchym cieście'], page, ['Sernik'])).toBe('https://cdn.test/szarlotka.jpg')
  })

  it('returns nothing when the dish is not named in the page, or the name is blank', () => {
    expect(imageAfterTitle(['Barszcz'], PAGE, others(SALAD))).toBeUndefined()
    expect(imageAfterTitle(['', '  '], PAGE, [])).toBeUndefined()
  })
})
