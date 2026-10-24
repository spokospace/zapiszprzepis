// Derive a Polish household measure from a WEIGHT amount (g/dag/kg) for a short
// list of stable baking staples, via a CURATED density table — never AI
// estimation, never a blanket formula (#505, #510). Many Polish bakes list only
// grams ("130 g mąki"); a cook who measures in szklanki gets a usable "ok. 1
// szklanka" for staples whose density is well-established, and nothing for
// variable/irregular ingredients (grated vegetables, chopped nuts, leafy greens)
// whose density swings too much — better empty than wrong (the carrot lesson, #505).
//
// Gramage is per 1 szklanka = 250 ml (the base `volume-measure.ts` uses). A
// weight-derived szklanka is approximate even for a staple, so it always carries
// the "ok." prefix. Butter is the one definitional case: a Polish block (kostka)
// is exactly 200 g, so an exact weight (e.g. 200 g) reads "1 kostka" without "ok.".
//
// Values from a verified culinary reference, not guessed:
//   Winiary (Nestlé) — "Jak odmierzyć mąkę i inne składniki?"
//   https://www.winiary.pl/porady/jak-odmierzyc-make-i-inne-skladniki/
// Wheat flour is anchored at 130 g per szklanka — the loosely-spooned convention
// cited in #510 (published tables span 130–170 g depending on packing).

import { parseAmount, quarterMeasure, SZKLANKI, KOSTKI, type PluralForms } from './measure-format'

type Staple = {
  /** Canonical label, for the density citation and tests. */
  key: string
  /** Grams per one output unit — one szklanka (250 ml), or one kostka for butter. */
  gramsPerUnit: number
  /** Matched against the normalized (lowercased) ingredient name. */
  match: RegExp
  /** Names that match `match` but must NOT be treated as this staple. */
  exclude?: RegExp
  /** Output unit; defaults to szklanki. */
  forms?: PluralForms
  /** Whether the measure is approximate (always "ok."); defaults to true. A
   *  density estimate is approximate; a definitional unit (kostka) is not. */
  approx?: boolean
}

// Ordered: the first staple whose `match` hits (and whose `exclude` misses) wins,
// so specific variants come before the generic one (cukier puder before cukier).
// Kept deliberately short and conservative — a name that matches nothing derives
// nothing, which is the safe outcome.
const STAPLES: Staple[] = [
  // Butter: one Polish block (kostka) is exactly 200 g — a definitional unit, so
  // an exact weight omits "ok.". "masło orzechowe" (peanut butter) is not sold in
  // kostki, so it is excluded. (`masł` collides with no other staple, so order is free.)
  { key: 'masło', gramsPerUnit: 200, forms: KOSTKI, approx: false, match: /masł|masel/, exclude: /orzech/ },
  { key: 'cukier puder', gramsPerUnit: 160, match: /puder|pudr/ },
  { key: 'cukier', gramsPerUnit: 200, match: /cukr|cukier/ },
  // Wheat flour only; potato/corn starch is much denser, so exclude it rather
  // than return a wrong szklanka for "mąka ziemniaczana".
  { key: 'mąka pszenna', gramsPerUnit: 130, match: /mąk|maki/, exclude: /ziemnia|kukurydz|skrobi/ },
  { key: 'ryż', gramsPerUnit: 200, match: /ryż|ryzu/ },
  { key: 'kasza manna', gramsPerUnit: 160, match: /mann/ },
  { key: 'kasza gryczana', gramsPerUnit: 180, match: /gryczan/ },
  { key: 'kasza jaglana', gramsPerUnit: 170, match: /jaglan/ },
  { key: 'płatki owsiane', gramsPerUnit: 80, match: /owsian/ },
  { key: 'kakao', gramsPerUnit: 110, match: /kakao/ },
]

/** The amount in grams when the unit is a weight unit, else null. */
function toGrams(amount: number, unit: string | undefined): number | null {
  const u = (unit ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (u === 'g' || u === 'gr' || u === 'gram' || u === 'gramy' || u === 'gramów') return amount
  if (u === 'dag' || u === 'dkg' || u === 'deko' || u === 'deka' || u === 'dekagram' || u === 'dekagramy') return amount * 10
  if (u === 'kg' || u === 'kilogram' || u === 'kilogramy' || u === 'kilogramów') return amount * 1000
  return null
}

/**
 * A household measure derived from a weight amount via the curated density table
 * above: "szklanki" for a staple, "kostki" for butter, or null when the unit is
 * not a weight, the amount is unparseable, or the ingredient name matches no
 * staple. A szklanka from weight is always prefixed "ok." (density is approximate);
 * butter is definitional, so an exact weight omits it.
 */
export function deriveWeightMeasure(
  amount: string | undefined,
  unit: string | undefined,
  name: string | undefined,
): string | null {
  const n = parseAmount(amount)
  if (n === null || n <= 0) return null
  const grams = toGrams(n, unit)
  if (grams === null || grams <= 0) return null

  const key = (name ?? '').trim().toLowerCase()
  if (!key) return null

  for (const s of STAPLES) {
    if (s.match.test(key) && !s.exclude?.test(key)) {
      return quarterMeasure(grams / s.gramsPerUnit, s.forms ?? SZKLANKI, { approx: s.approx ?? true })
    }
  }
  return null
}
