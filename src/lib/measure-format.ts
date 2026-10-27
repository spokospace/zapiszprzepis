// Shared formatting primitives for the deterministic "household measure" feature
// (#505): the amount parser and the quarter-rounded measure formatter. Both the
// volume derivation (`volume-measure.ts`) and the weight-staple derivation
// (`weight-density.ts`) build on these so the "ok." prefix, the 1/4 rounding and
// the Polish plurals read identically across both.

import { polishPlural } from './recipe-meta'

/** Parse a Polish amount to a positive number: "1,5", "1.5", "1/2", "1 1/2", "200". */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null
  const s = raw.trim().replace(',', '.')
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/) // mixed "1 1/2"
  if (m) return Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null
  m = s.match(/^(\d+)\/(\d+)$/) // fraction "1/2"
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null
}

/** Fraction glyphs a recipe source may use, as the "n/d" they stand for. */
export const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '¼': '1/4',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
}

// "2 1/2", "2½" — a whole number followed by a fraction, not part of a longer
// number ("12/2025", "1,5 1/2") on either side.
const MIXED_FRACTION = new RegExp(
  `(?<![\\d,./])(\\d+)(?:\\s+(\\d+)/(\\d+)|\\s*([${Object.keys(UNICODE_FRACTIONS).join('')}]))(?![\\d/])`,
  'g',
)

/**
 * Rewrite every mixed fraction in a household measure as a Polish decimal, for
 * readability (#535): "2 1/2 szklanki" → "2,5 szklanki", "ok. 1 3/4 kostki" →
 * "ok. 1,75 kostki". Everything else is kept as written — qualifiers ("ok.",
 * "około", "do"), unit words, decimals and bare fractions ("3/4 kostki", which
 * read fine as they are). A mixed fraction whose decimal would run past two
 * places ("1 1/3") or that is not a proper fraction ("1 3/2") is left alone too.
 */
export function decimalMixedFractions(measure: string): string {
  return measure.replace(MIXED_FRACTION, (match, whole: string, num?: string, den?: string, glyph?: string) => {
    const [n, d] = (glyph ? UNICODE_FRACTIONS[glyph] : `${num}/${den}`).split('/').map(Number)
    if (!(d > n && n > 0)) return match
    const value = Number(whole) + n / d
    const rounded = Math.round(value * 100) / 100
    return Math.abs(rounded - value) > 1e-9 ? match : String(rounded).replace('.', ',')
  })
}

/** The three Polish plural forms of a counted unit. */
export type PluralForms = { one: string; few: string; many: string }

export const SZKLANKI: PluralForms = { one: 'szklanka', few: 'szklanki', many: 'szklanek' }
export const KOSTKI: PluralForms = { one: 'kostka', few: 'kostki', many: 'kostek' }

const QUARTER = ['', '1/4', '1/2', '3/4']

/** A count of quarters as text: 3 → "3/4", 4 → "1", 6 → "1 1/2". */
function formatQuarters(quarters: number): string {
  const whole = Math.floor(quarters / 4)
  const rem = quarters % 4
  if (rem === 0) return String(whole)
  return whole ? `${whole} ${QUARTER[rem]}` : QUARTER[rem]
}

/**
 * Format a (possibly fractional) count of a unit, rounded to the nearest 1/4, as
 * e.g. "1 szklanka", "ok. 3/4 szklanki", "1 1/2 kostki". Null when the count is
 * non-positive or rounds to zero quarters (too small to show — better nothing).
 *
 * The "ok. " prefix marks an approximate value: it is added when rounding lost
 * precision, or always when `opts.approx` is set (a density-derived szklanka is
 * approximate even when the arithmetic lands on a round number).
 */
export function quarterMeasure(
  count: number,
  forms: PluralForms,
  opts?: { approx?: boolean },
): string | null {
  if (!(count > 0)) return null
  const quarters = Math.round(count * 4)
  if (quarters === 0) return null
  const exact = Math.abs(count - quarters / 4) < 1e-6
  // A non-whole count ("3/4", "1 1/2") always takes the `few` (genitive) form in
  // Polish — "3/4 szklanki", not "3/4 szklanka".
  const word = quarters % 4 === 0 ? polishPlural(quarters / 4, forms.one, forms.few, forms.many) : forms.few
  const prefix = exact && !opts?.approx ? '' : 'ok. '
  return `${prefix}${formatQuarters(quarters)} ${word}`
}
