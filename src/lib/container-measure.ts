// A US ingredient given by its packaging ("2 (14.5 oz) cans tomatoes"), read
// from the source line the model copies into `source`: the model multiplies
// count by size only sometimes (#575), so the total is computed here. The size
// in parentheses is one container's; an author who writes the total there
// ("1 1/2 (12 ounces) blocks") reads as 18 oz, and nothing in the text says.

import { KOSTKI, quarterMeasure, type PluralForms } from './measure-format'
import { METRIC_MEASURE, metricUnits, NUMBER, toNumber } from './us-units'

const COUNT = `(?<count>${NUMBER})`
const SIZE = String.raw`(?<size>\d+(?:[.,]\d+)?)`
const UNIT = String.raw`(?<unit>fl\.?\s*oz\.?|fluid\s+ounces?|ounces?|oz\.?|pounds?|lbs?\.?|grams?|g|ml|millilit(?:er|re)s?|lit(?:er|re)s?|l)`
const CONTAINER = String.raw`(?<container>cans?|tins?|packages?|pkgs?\.?|packets?|boxe?s?|bags?|pouch(?:es)?|blocks?|sticks?|bricks?|jars?|bottles?|tubs?|containers?|cartons?)`

// "2 (14.5 oz) cans", "1 (8-ounce) package", "2 15-ounce cans", "2 cans (15 oz each)"
const SHAPES = [
  new RegExp(`^${COUNT}\\s*\\(\\s*${SIZE}[\\s-]*${UNIT}\\s*\\)\\s*${CONTAINER}\\b`, 'iu'),
  new RegExp(`^${COUNT}\\s+${SIZE}[\\s-]*${UNIT}\\s+${CONTAINER}\\b`, 'iu'),
  new RegExp(`^${COUNT}\\s+${CONTAINER}\\s*\\(\\s*${SIZE}[\\s-]*${UNIT}(?:\\s+each)?\\s*\\)`, 'iu'),
]

// A metric size needs no conversion, only the unit's spelling.
const METRIC_SIZE: [RegExp, number, 'g' | 'ml'][] = [
  [/^g/i, 1, 'g'],
  [/^(?:ml|millilit)/i, 1, 'ml'],
  [/^(?:l|lit)/i, 1000, 'ml'],
]

const FORMS: [RegExp, PluralForms][] = [
  [/^(?:can|tin)/i, { one: 'puszka', few: 'puszki', many: 'puszek' }],
  [/^(?:block|stick|brick)/i, KOSTKI],
  [/^jar/i, { one: 'słoik', few: 'słoiki', many: 'słoików' }],
  [/^bottle/i, { one: 'butelka', few: 'butelki', many: 'butelek' }],
  [/^(?:package|pkg|packet|box|bag|pouch|tub|container|carton)/i, { one: 'opakowanie', few: 'opakowania', many: 'opakowań' }],
]

/** The packaged ingredient's total as a metric measure plus its Polish container count, or null when the line is not one. */
export function containerMeasure(source: string): { amount: string; unit: 'g' | 'ml'; alt: string } | null {
  const line = source.trim()
  for (const shape of SHAPES) {
    const groups = shape.exec(line)?.groups
    if (!groups) continue
    const count = toNumber(groups.count)
    const total = count * Number(groups.size.replace(',', '.'))
    if (!(total > 0)) return null
    const metric = METRIC_SIZE.find(([re]) => re.test(groups.unit))
    const measure = metric
      ? [String(Math.round(total * metric[1])), metric[2]]
      : METRIC_MEASURE.exec(metricUnits(`${total} ${groups.unit}`))?.slice(1)
    if (!measure) return null
    const forms = FORMS.find(([re]) => re.test(groups.container))?.[1]
    return { amount: measure[0], unit: measure[1] as 'g' | 'ml', alt: (forms && quarterMeasure(count, forms)) || '' }
  }
  return null
}
