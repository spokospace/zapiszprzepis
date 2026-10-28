// A US household measure read from the ingredient's source line ("2 cups grape
// tomatoes", "1 1/2 teaspoons oregano"), as the Polish `alt` the prompt asks the
// model to write beside the metric amount. The model skips it in about one line
// in four (the dip's 475 ml of tomatoes), and the page then re-derives a measure
// from the millilitres — approximate ("ok. 2 szklanki") and, for a spoon, often a
// different one ("7.5 ml" → "ok. 2 łyżeczki" for 1 1/2 teaspoons). The stated
// measure is exact, so it is read from the line instead.

import { KOSTKI, LYZECZKI, LYZKI, type PluralForms, SZKLANKI } from './measure-format'
import { polishPlural } from './recipe-meta'
import { NUMBER, plainFraction, toNumber } from './us-units'

const MEASURES: [RegExp, PluralForms][] = [
  [/^cups?$/i, SZKLANKI],
  [/^(?:tablespoons?|tbsps?|tbs)$/i, LYZKI],
  [/^(?:teaspoons?|tsp)$/i, LYZECZKI],
  [/^sticks?$/i, KOSTKI],
]

// The measure opens the line; a range ("2-3 tablespoons") is left to the model.
const STATED = new RegExp(String.raw`^(${NUMBER})\s*(cups?|tablespoons?|tbsps?|tbs|teaspoons?|tsp|sticks?)\b(?!\s*(?:-|–|to)\s*\d)`, 'iu')

/** The Polish household measure the source line states ("2 cups …" → "2 szklanki"), or null when it states none. */
export function householdAlt(source: string): string | null {
  const m = STATED.exec(source.trim())
  if (!m) return null
  const forms = MEASURES.find(([re]) => re.test(m[2]))?.[1]
  const count = toNumber(m[1])
  if (!forms || !(count > 0)) return null
  // A non-whole count takes the genitive ("1/4 szklanki", "1 1/2 łyżeczki");
  // the number is written as the stored `alt` does: "1 1/2", "1/4", "1,5".
  const word = Number.isInteger(count) ? polishPlural(count, forms.one, forms.few, forms.many) : forms.few
  return `${plainFraction(m[1]).replace('.', ',')} ${word}`
}
