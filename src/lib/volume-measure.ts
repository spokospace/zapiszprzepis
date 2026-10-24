// Derive a Polish household measure (szklanki / łyżki / łyżeczki) from a VOLUME
// amount, using fixed, verified ratios that do not depend on the ingredient:
//   1 szklanka = 250 ml · 1 łyżka = 15 ml · 1 łyżeczka = 5 ml
// This is the deterministic half of the "alternative measure" feature (#505): a
// volume amount converts exactly, so we can show it ourselves without guessing.
// A WEIGHT amount (g/dag/kg) does not convert this way — grams → volume depends on
// the ingredient's density — so it is handled separately, only for stable staples
// with a curated density table, in `weight-density.ts`.

import { parseAmount, quarterMeasure, SZKLANKI } from './measure-format'
import { polishPlural } from './recipe-meta'

const ML_SZKLANKA = 250
const ML_LYZKA = 15
const ML_LYZECZKA = 5

/** The amount in millilitres when the unit is a volume unit, else null. */
function toMl(amount: number, unit: string | undefined): number | null {
  const u = (unit ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (u === 'ml' || u === 'mililitr' || u === 'mililitry' || u === 'mililitrów') return amount
  if (u === 'l' || u === 'litr' || u === 'litry' || u === 'litrów' || u === 'liter') return amount * 1000
  return null
}

/**
 * A household measure derived from a volume amount via the fixed ratios above,
 * or null for a non-volume unit / unparseable amount. The result is prefixed
 * "ok. " only when rounding lost precision (an exact conversion like 250 ml =
 * "1 szklanka" is shown without it).
 */
export function deriveVolumeMeasure(amount: string | undefined, unit: string | undefined): string | null {
  const n = parseAmount(amount)
  if (n === null || n <= 0) return null
  const ml = toMl(n, unit)
  if (ml === null || ml <= 0) return null

  // A quarter of a szklanka (62.5 ml) and up reads best in szklanki; below that
  // in łyżki, and the smallest amounts in łyżeczki.
  if (ml >= ML_SZKLANKA / 4) {
    return quarterMeasure(ml / ML_SZKLANKA, SZKLANKI)
  }

  const useLyzka = ml >= ML_LYZKA
  const perUnit = useLyzka ? ML_LYZKA : ML_LYZECZKA
  const count = Math.round(ml / perUnit)
  if (count <= 0) return null
  const exact = Math.abs(ml - count * perUnit) < 1e-6
  const word = useLyzka
    ? polishPlural(count, 'łyżka', 'łyżki', 'łyżek')
    : polishPlural(count, 'łyżeczka', 'łyżeczki', 'łyżeczek')
  return `${exact ? '' : 'ok. '}${count} ${word}`
}
