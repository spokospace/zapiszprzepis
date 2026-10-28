// US units left in a step's text, converted in code. The prompt asks for
// metric everywhere, but a model copies a sentence as written ("mix with about
// 7 ounces each" → „z około 7 uncjami”), so a step gets the same deterministic
// treatment the ingredient measures do.

import { parseAmount, UNICODE_FRACTIONS } from './measure-format'
// (parseAmount reads the numbers the rules below find; metricIngredient reuses the rules themselves.)

const GLYPHS = Object.keys(UNICODE_FRACTIONS).join('')
// "7", "1.5", "1 1/2", "1/2", "½", "1½" — the glyph forms first, so "1½" is not read as "1".
export const NUMBER = String.raw`\d*[${GLYPHS}]|\d+(?:\s+\d+/\d+|/\d+|[.,]\d+)?`
const RANGE = String.raw`(${NUMBER})(?:\s*(?:-|–|do)\s*(${NUMBER}))?`
const GLYPH = new RegExp(`(\\d*)([${GLYPHS}])`, 'g')

/** A NUMBER match as a number; 0 when it cannot be read. */
export const toNumber = (raw: string) =>
  parseAmount(raw.replace(GLYPH, (_, whole: string, f: string) => `${whole} ${UNICODE_FRACTIONS[f]}`).trim()) ?? 0

const roundTo = (value: number, step: number) => Math.max(step, Math.round(value / step) * step)
// Grams to the step a kitchen scale reads at that size.
const grams = (g: number) => roundTo(g, g < 50 ? 5 : g < 1000 ? 10 : 50)
const cm = (n: number) => roundTo(n * 2.54, 1)
// Oven settings land on the usual 10 °C marks (350 °F → 180 °C); a probe
// temperature (165 °F for chicken) stays exact to the degree.
const celsius = (f: number) => {
  const c = ((f - 32) * 5) / 9
  return f >= 250 ? Math.round(c / 10) * 10 : Math.round(c)
}

function convertRange([, from, to]: string[], convert: (n: number) => number, unit: string): string {
  const a = convert(toNumber(from))
  return to ? `${a}–${convert(toNumber(to))}${unit}` : `${a}${unit}`
}

const INCH = String.raw`inch(?:es)?\b|in\.|cal\p{L}*|″|"`
const RULES: [RegExp, (m: string[]) => string][] = [
  // Fluid ounces before ounces.
  [new RegExp(`${RANGE}\\s*(?:fl\\.?\\s*oz|fluid\\s+ounces?|uncj\\p{L}*\\s+płynn\\p{L}*)`, 'giu'), (m) => convertRange(m, (n) => roundTo(n * 29.57, 5), ' ml')],
  [new RegExp(`${RANGE}\\s*(?:ounces?|oz\\b\\.?|uncj\\p{L}*)`, 'giu'), (m) => convertRange(m, (n) => grams(n * 28.35), ' g')],
  [new RegExp(`${RANGE}\\s*(?:pounds?|lbs?\\b\\.?|funt\\p{L}*)`, 'giu'), (m) => convertRange(m, (n) => grams(n * 453.6), ' g')],
  [new RegExp(`${RANGE}\\s*(?:pint\\p{L}*)`, 'giu'), (m) => convertRange(m, (n) => roundTo(n * 473.2, 5), ' ml')],
  [new RegExp(`${RANGE}\\s*(?:quart\\p{L}*|kwart\\p{L}*)`, 'giu'), (m) => convertRange(m, (n) => roundTo(n * 946.4, 5), ' ml')],
  [new RegExp(`${RANGE}\\s*(?:°\\s*F\\b|stopni\\p{L}*\\s+(?:F\\b|Fahrenheit\\p{L}*)|degrees?\\s+(?:F\\b|Fahrenheit))`, 'giu'), (m) => convertRange(m, celsius, '°C')],
  // "9 x 13 inch", "9x13-calowa"
  [new RegExp(`(${NUMBER})\\s*[x×]\\s*(${NUMBER})[\\s-]*(?:${INCH})`, 'giu'), ([, a, b]) => `${cm(toNumber(a))} × ${cm(toNumber(b))} cm`],
  // "9-calowej formie" → "23-centymetrowej formie"
  [new RegExp(`(${NUMBER})-calow(\\p{L}*)`, 'giu'), ([, n, ending]) => `${cm(toNumber(n))}-centymetrow${ending}`],
  [new RegExp(`${RANGE}[\\s-]*(?:${INCH})`, 'giu'), (m) => convertRange(m, cm, ' cm')],
]

const HAS_NUMBER = new RegExp(`[\\d${GLYPHS}]`)

/** The text with every US weight, temperature and length in it written metric. */
export function metricUnits(text: string): string {
  if (!HAS_NUMBER.test(text)) return text
  return RULES.reduce((out, [re, write]) => out.replace(re, (...args) => write(args as string[])), text)
}

/** "18 uncji" → "510 g": a measure the rules above wrote, as [amount, unit]. */
export const METRIC_MEASURE = /^(\S+) (g|ml)$/

/**
 * The ingredient with a US unit written metric: in its own `unit` field ("18"
 * + "uncji", "1" + "pint" — read together as one measure, so a range works too)
 * and inside its name. Cups, spoons and sticks are left: as szklanki, łyżki and
 * kostki they are Polish household measures already.
 */
export function metricIngredient<T extends { name: string; amount: string; unit: string }>(ingredient: T): T {
  const name = metricUnits(ingredient.name)
  const measure = ingredient.unit ? METRIC_MEASURE.exec(metricUnits(`${ingredient.amount} ${ingredient.unit}`)) : null
  const [amount, unit] = measure ? [measure[1], measure[2]] : [ingredient.amount, ingredient.unit]
  if (name === ingredient.name && amount === ingredient.amount && unit === ingredient.unit) return ingredient
  return { ...ingredient, name, amount, unit }
}
