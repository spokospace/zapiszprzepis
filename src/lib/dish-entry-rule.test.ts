import { describe, it, expect } from 'vitest'
import { dropInlineOnlyDishes } from './dish-entry-rule'

const ing = (...names: string[]) => names.map((name) => ({ name }))

const PAGE = `Zakwas ze świeżych buraków
Z pozostałych po odlaniu płynu buraków możecie przygotować szybką sałatkę z kiszonych buraków.
300-400g kiszonych buraków kroimy drobno w słupki, dodajemy drobno pokrojony 1 kiszony ogórek, 1 czerwoną średnią cebulę lub szalotkę, starte na tarce małe twarde, słodko-winne jabłko. Doprawiamy całość oliwą z oliwek, solą, pieprzem i odrobiną cukru.
SKŁADNIKI
850-1000g buraków, najlepiej długich
2 litry wody, koniecznie miękkiej
2 płaskie łyżki stołowe soli kamiennej
½ główki czosnku
5-6 listków laurowych
8-10 ziaren ziela angielskiego
1 łyżeczka czarnego ziarnistego pieprzu`

const STARTER = { title: 'Zakwas', ingredients: ing('buraki', 'woda', 'sól kamienna', 'czosnek', 'listki laurowe', 'ziele angielskie', 'czarny pieprz') }
const SALAD = { title: 'Sałatka', ingredients: ing('kiszone buraki', 'kiszony ogórek', 'czerwona cebula', 'jabłko', 'oliwa z oliwek', 'sól', 'pieprz', 'cukier') }

describe('dropInlineOnlyDishes (#759)', () => {
  it('drops a serving idea whose ingredients are only named inside a sentence', () => {
    expect(dropInlineOnlyDishes([STARTER, SALAD], PAGE)).toEqual([STARTER])
  })

  it('keeps every entry of a page whose dishes all have a list', () => {
    const page = `${PAGE}\nSAŁATKA\n300 g kiszonych buraków\n1 kiszony ogórek\n1 czerwona cebula\n1 jabłko\nolej\nsól\nodrobina cukru`
    expect(dropInlineOnlyDishes([STARTER, SALAD], page)).toEqual([STARTER, SALAD])
  })

  it('keeps all entries when none of them is listed (every recipe written as prose)', () => {
    const prose = 'Pokrój ogórek i cebulę w kostkę, dodaj jabłko, oliwę, sól i cukier, wymieszaj dokładnie i podawaj od razu po przygotowaniu sałatki.'
    expect(dropInlineOnlyDishes([SALAD, { title: 'Inna', ingredients: ing('ogórek', 'cebula') }], prose)).toHaveLength(2)
  })

  it('leaves a single entry alone', () => {
    expect(dropInlineOnlyDishes([SALAD], PAGE)).toEqual([SALAD])
  })
})
