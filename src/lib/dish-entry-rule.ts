// What counts as a dish of its own in a post that gives several (#759). The extraction
// prompt returns one entry per dish; a blog post that gives ONE recipe and then closes
// with a sentence on what to do with its leftovers ("z pozostałych buraków możecie
// przygotować sałatkę…") used to come back as two entries, so one link became two
// recipes, the second built from a single paragraph and wearing the first one's photo.

export const DISH_ENTRY_RULE = `A dish is an entry of its own only when the page gives it as a recipe: its own heading or title and its own ingredient list or method. A serving idea, a side suggestion or a use for the leftovers or by-products of the main recipe ("z pozostałych po odlaniu płynu buraków możecie przygotować sałatkę", "do tego pasuje sos czosnkowy", "z reszty ciasta zrobisz paluszki"), written as a sentence or a short paragraph with no ingredient list of its own, is NOT an entry: it stays in the main dish as part of its final "Opcjonalnie: " step. A page with one recipe returns exactly one entry. When unsure, return one entry.`

/** The words of `text` that name something, lower-cased: letters only, at least 4 of them. */
const stems = (name: string): string[] =>
  (name.toLowerCase().match(/\p{L}{4,}/gu) ?? []).map((word) => word.slice(0, 5))

// An ingredient line starts with a quantity (a digit or a fraction) or a bullet, and is short.
// A sentence, a heading or a comment starts with a letter or "#", so a word the page repeats
// there ("kiszone", "czerwony") does not make an ingredient look listed.
const LIST_ITEM_START = /^\s*(?:[-*•]\s|[\d½¼¾⅓⅔])/

/** The short lines of the page that look like items of a list, lower-cased, marker removed. */
function listLines(pageText: string): string[] {
  return pageText
    .split(/\r?\n/)
    .filter((line) => LIST_ITEM_START.test(line) && line.trim().length <= 140)
    .map((line) => line.replace(/^[\s>*\-•\d.)]+/, '').trim().toLowerCase())
    .filter((line) => line.length > 0)
}

/** Does the page carry this ingredient as a line of a list (a short line with the ingredient's name)? */
function isListed(name: string, lines: readonly string[]): boolean {
  const wanted = stems(name)
  return wanted.length > 0 && lines.some((line) => wanted.some((stem) => line.includes(stem)))
}

/**
 * Backstop for DISH_ENTRY_RULE, which the model does not always follow (#759): of several
 * entries, an entry whose ingredients mostly are not listed anywhere on the page (the page
 * only names them inside a sentence, as in "z pozostałych buraków możecie przygotować
 * sałatkę z ogórka, cebuli i jabłka") is a serving idea, not a recipe, and is dropped, as
 * long as another entry is a listed recipe. When no entry is listed (every recipe written
 * as prose) or there is only one, the entries are returned as they are.
 */
export function dropInlineOnlyDishes<T extends { ingredients: ReadonlyArray<{ name?: string }> }>(
  entries: readonly T[],
  pageText: string,
): T[] {
  if (entries.length < 2) return [...entries]
  const lines = listLines(pageText)
  const listed = entries.map((entry) => {
    const names = entry.ingredients.map((i) => i.name ?? '')
    const count = names.filter((name) => isListed(name, lines)).length
    return count >= Math.max(2, Math.ceil(names.length / 2))
  })
  if (!listed.some(Boolean)) return [...entries]
  return entries.filter((_, index) => listed[index])
}
