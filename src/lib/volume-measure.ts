// Derive a Polish household measure (szklanki / łyżki / łyżeczki) from a VOLUME
// amount, using fixed, verified ratios that do not depend on the ingredient:
//   1 szklanka = 250 ml · 1 łyżka = 15 ml · 1 łyżeczka = 5 ml
// This is the deterministic half of the "alternative measure" feature (#505): a
// volume amount converts exactly, so we can show it ourselves without guessing.
// Weight (g/dag/kg) is deliberately NOT handled — grams → volume depends on the
// ingredient's density ("300 g startej marchewki" is not reliably "3 szklanki"),
// so it belongs to a curated per-ingredient table, not this helper.

const ML_SZKLANKA = 250
const ML_LYZKA = 15
const ML_LYZECZKA = 5

/** Polish plural: 1 → one; 2–4 (but not 12–14) → few; otherwise many. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (n === 1) return one
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few
  return many
}

/** Parse a Polish amount to a positive number: "1,5", "1.5", "1/2", "1 1/2", "200". */
function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null
  const s = raw.trim().replace(',', '.')
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/) // mixed "1 1/2"
  if (m) return Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null
  m = s.match(/^(\d+)\/(\d+)$/) // fraction "1/2"
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null
}

/** The amount in millilitres when the unit is a volume unit, else null. */
function toMl(amount: number, unit: string | undefined): number | null {
  const u = (unit ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (u === 'ml' || u === 'mililitr' || u === 'mililitry' || u === 'mililitrów') return amount
  if (u === 'l' || u === 'litr' || u === 'litry' || u === 'litrów' || u === 'liter') return amount * 1000
  return null
}

const QUARTER = ['', '1/4', '1/2', '3/4']

/** A count of quarter-szklanki as text: 3 → "3/4", 4 → "1", 6 → "1 1/2". */
function formatSzklanki(quarters: number): string {
  const whole = Math.floor(quarters / 4)
  const rem = quarters % 4
  if (rem === 0) return String(whole)
  return whole ? `${whole} ${QUARTER[rem]}` : QUARTER[rem]
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
    const quarters = Math.round((ml / ML_SZKLANKA) * 4)
    if (quarters === 0) return null
    const exact = Math.abs(ml - (quarters / 4) * ML_SZKLANKA) < 1e-6
    const word = quarters % 4 === 0 ? plural(quarters / 4, 'szklanka', 'szklanki', 'szklanek') : 'szklanki'
    return `${exact ? '' : 'ok. '}${formatSzklanki(quarters)} ${word}`
  }

  const useLyzka = ml >= ML_LYZKA
  const perUnit = useLyzka ? ML_LYZKA : ML_LYZECZKA
  const count = Math.round(ml / perUnit)
  if (count <= 0) return null
  const exact = Math.abs(ml - count * perUnit) < 1e-6
  const word = useLyzka
    ? plural(count, 'łyżka', 'łyżki', 'łyżek')
    : plural(count, 'łyżeczka', 'łyżeczki', 'łyżeczek')
  return `${exact ? '' : 'ok. '}${count} ${word}`
}
