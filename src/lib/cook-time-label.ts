// Kitchen nouns that name baking without the recipe itself being baked:
// pancakes use baking powder, no-bake cakes sit on baking paper.
const BAKING_EQUIPMENT = /(proszek|proszku|papier|papieru|papierem|rękaw|rękawa|rękawie) do pieczenia/giu

// Every Polish baking word shares the stem piek-/piec-: piekarnik, piekłam,
// upiec, pieczemy, zapiekanka. Mushrooms and bread share it too.
const BAKING_WORD = /\p{L}*pie[kc]\p{L}*/giu
const NOT_BAKING = /pieczar|pieczyw/u

/**
 * Label for `cook_time_minutes`. The extractor follows schema.org `cookTime`,
 * which covers any heat treatment, so a cookie recipe's 20 minutes in the oven
 * lands in the same field as a soup's simmering. Read the steps to name it.
 */
export function cookTimeLabel(steps: readonly string[]): 'Pieczenie' | 'Gotowanie' {
  const text = steps.join(' ').toLowerCase().replace(BAKING_EQUIPMENT, '')
  const baked = (text.match(BAKING_WORD) ?? []).some((word) => !NOT_BAKING.test(word))
  return baked ? 'Pieczenie' : 'Gotowanie'
}
