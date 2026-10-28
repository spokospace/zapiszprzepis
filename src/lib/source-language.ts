// Whether a recipe's source text is Polish (#524). A foreign source gets extra
// localization rules and a stronger model; read from the text itself, since every
// source path (Firecrawl, Jina, Blogger feed, Facebook caption, YouTube) has one,
// and many Polish blogs ship an `en-US` theme `<html lang>`.

import { UNICODE_FRACTIONS } from './measure-format'

export type SourceLanguage = 'pl' | 'foreign'

// The extraction model for a Polish source. gpt-5.4-mini replaced gpt-4o-mini
// after the #526 offline eval (26 recipes, 5 models): it roughly halves the raw
// `alt` rule violations (23 vs 48) the #525 guard was patching, all but
// eliminates step-form violations (1 vs 83), and is the fastest (p95 ~6 s vs
// ~13 s) — at a few dozen extractions a month its higher list price is still
// cents. It runs at its DEFAULT reasoning effort ('none'), which is why the call
// in run-extract-recipe.ts keeps `temperature: 0.3` + `response_format`
// unchanged; the gpt-5 *mini/nano* tiers reject `temperature` and would need a
// request change (see context/foundation/extraction-model-eval-2026-10.md).
export const EXTRACTION_MODEL = 'gpt-5.4-mini'
/** The model for a foreign source: the same one since the foreign eval (see
 *  extraction-model-eval-2026-10.md). Its own constant so the paths can be
 *  split again; must differ from LABEL_MODEL. */
export const FOREIGN_EXTRACTION_MODEL = EXTRACTION_MODEL

// Polish text runs ~6–8% diacritic letters; an English page with a Polish word or
// two stays far below this.
const PL_DIACRITIC_SHARE = 0.015
const SAMPLE_CHARS = 8000

const PL_WORDS = new Set(['i', 'w', 'z', 'na', 'się', 'do', 'oraz', 'jest', 'ze', 'po', 'od', 'dla', 'lub', 'aby', 'też', 'albo', 'ok'])
const EN_WORDS = new Set(['the', 'and', 'with', 'of', 'to', 'a', 'for', 'in', 'is', 'cup', 'cups', 'until', 'into', 'or', 'it', 'you'])

export function detectSourceLanguage(text: string): SourceLanguage {
  const sample = text
    .slice(0, SAMPLE_CHARS)
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
  const letters = sample.match(/\p{L}/gu)?.length ?? 0
  // Nothing to read: treat it as foreign — the extra rules are harmless on
  // Polish text, a missed translation is not.
  if (letters === 0) return 'foreign'
  const diacritics = sample.match(/[ąćęłńóśźż]/g)?.length ?? 0
  if (diacritics / letters >= PL_DIACRITIC_SHARE) return 'pl'
  // Polish typed without diacritics ("ciasto z jablkami") still uses its own
  // short words.
  let pl = 0
  let en = 0
  for (const word of sample.match(/\p{L}+/gu) ?? []) {
    if (PL_WORDS.has(word)) pl++
    else if (EN_WORDS.has(word)) en++
  }
  return pl > en ? 'pl' : 'foreign'
}

/** Ingredient fields a foreign source adds to the JSON schema; the model follows
 *  the schema line where it skipped a rule bullet (1 of 3 runs). */
export const FOREIGN_INGREDIENT_FIELDS = '"source": "the ingredient line exactly as the source writes it, untranslated", '

/** Appended to the extraction prompt for a foreign source only. */
export const FOREIGN_SOURCE_RULES = `
The source is NOT in Polish. Localize it for a cook in Poland:
- Translate EVERY word to Polish, including preparation notes and asides in steps ("finely grated" → "drobno starty", "chunky guac" → "guacamole z kawałkami awokado"). No English word may remain except proper names.
- Use natural Polish culinary phrasing, not word-for-word: "ground turkey/beef/pork" → "mięso mielone z indyka" / "mielona wołowina" / "mięso mielone wieprzowe"; "a splash" → "odrobina"; "kosher salt" → "sól"; "all-purpose flour" → "mąka pszenna"; "simmer" → "gotować na małym ogniu" (never "simmerować").
- Name products the way a Polish shop does. Pasta shapes: "alphabet" → "literki", "rings"/"anelli" → "kółka", "stars"/"stelline" → "gwiazdki", "elbows" → "kolanka", "shells" → "muszelki", "ditalini" → "małe rurki (ditalini)", "orzo" → "orzo (makaron w kształcie ryżu)"; "tiny pasta" → "drobny makaron do zup". US label grades mean nothing here: drop lean percentages and ratios ("94% lean", "85/15", "I like 94%"), at most write "chude" ("mięso mielone z indyka (najlepiej chude)").
- Steps read like a Polish cookbook, not a translation: "Place the turkey in a bowl" → "Mięso mielone przełożyć do miski", never "Umieścić … w misce"; "Add X to the pan" → "Na patelnię dodać X"; prefer "przełożyć", "włożyć", "wsypać", "wlać", "odłożyć" over "umieścić".
- Convert every US unit: pounds and ounces to grams (1 lb ≈ 450 g, 1 oz ≈ 28 g), fluid ounces and quarts to ml, sticks of butter to grams (1 stick ≈ 113 g), °F to °C (350°F → 180°C) — in steps too, and say "°C".
- "alt" holds only a Polish household measure ("1 szklanka", "2 łyżki", "1/2 kostki"); never pounds, ounces or any English word there. This overrides the "alt" rule above: write stated cups, sticks and spoons as szklanki, kostki and łyżki. Only those: an amount the source gives in pounds, ounces or grams gets an empty "alt" — never turn a weight into szklanki ("½ pound pasta" → "225 g", "alt": ""). A preparation note goes into "name" ("szalotka drobno starta"), not "alt".
- Title: name the dish the way a Polish cookbook would, never word for word. An English title stacks nouns, and the last one is usually the dish while the others describe it, so decide what the dish IS first: "White Pizza Dip" is a dip that tastes like white pizza → "Dip à la biała pizza" (not "Dip biała pizza", not "Dip do pizzy", not "Dip jak biała pizza"); "Pizza Pasta" → "Makaron à la pizza" (never "Makaron pizza"); "Garlic Bread Pizza Crust" → "Spód do pizzy à la chleb czosnkowy"; "Burst Tomato Burrata Pasta" → "Makaron z burratą i pieczonymi pomidorkami". A dish made in the manner of another takes "à la" or "w stylu", never "jak" and never a bare noun stack. Translate every word by its meaning in the recipe ("leeks" → "pory", never "kluski"). A dish name Polish uses as it is — croissant, brownie, muffin, bagel, scones, focaccia, hummus, tiramisu, pavlova — stays, inflected the Polish way ("How to make croissants" → "Croissanty", never "Rogaliki francuskie" nor "Rogaliki croissant"; "Brownie z orzechami"), never replaced by a description. Keep it short.
- "source": the ingredient's line copied verbatim ("2 (14.5 oz) cans diced tomatoes, drained") — never translated, converted or reworded; an empty string when the content gives no such line (a video).
- Brands: when the brand IS the dish (a homemade copy, "Homemade SpaghettiOs"), keep the brand with its own spelling in the title ("Domowe SpaghettiOs z chrupiącym manchego") and keep the title short. When a branded product is an INGREDIENT (Crisco, Old Bay, Ro-Tel), name the generic Polish product instead ("tłuszcz roślinny do pieczenia").
Examples (wrong → right): {"name": "mielone indyka", "amount": "450", "unit": "g", "alt": "1 funt"} → {"name": "mięso mielone z indyka", "amount": "450", "unit": "g", "alt": ""}; {"name": "szalotka", "amount": "1", "alt": "finely grated"} → {"name": "szalotka drobno starta", "amount": "1", "alt": ""}; {"name": "ser burrata", "amount": "225", "unit": "g", "alt": "8 uncji"} → {"name": "ser burrata", "amount": "225", "unit": "g", "alt": ""}; {"name": "makaron", "amount": "225", "unit": "g", "alt": "1/2 szklanki"} (source: "½ pound pasta") → {"name": "makaron", "amount": "225", "unit": "g", "alt": ""}; {"name": "mały makaron (np. ditalini, alfabet)"} → {"name": "drobny makaron do zup, np. literki lub małe rurki (ditalini)"}; {"name": "mięso mielone z indyka (94% chude)"} → {"name": "mięso mielone z indyka (najlepiej chude)"}.`

// A US household measure, by its Polish name in `alt` and its English names in the source.
const US_MEASURE: { pl: RegExp; en: RegExp; key: string }[] = [
  { pl: /^łyżecz/i, en: /^(teaspoons?|tsp)$/, key: 'tsp' },
  { pl: /^łyż/i, en: /^(tablespoons?|tbsps?|tbs)$/, key: 'tbsp' },
  { pl: /^szklan/i, en: /^cups?$/, key: 'cup' },
  { pl: /^kost/i, en: /^sticks?$/, key: 'stick' },
]
// "2/3 cup", "1 tablespoon" in the source; never the "2" of "1/2" (lookbehind).
const STATED_MEASURE = /(?<![\d/.])(\d+(?:[/.]\d+)?)\s*(teaspoons?|tsp|tablespoons?|tbsps?|tbs|cups?|sticks?)\b/g
const UNICODE_FRACTION = new RegExp(`[${Object.keys(UNICODE_FRACTIONS).join('')}]`, 'g')
const fractions = (s: string) => s.replace(UNICODE_FRACTION, (f) => ` ${UNICODE_FRACTIONS[f]}`).replace(/\s+/g, ' ')
// "ok. 1/2 szklanki" → ["1/2", "szklanki"]
const ALT_PARTS = /^(?:ok\.|około|do)?\s*(\d+(?:[/,.]\d+)?)\s+(\p{L}+)/u

/** Every "<quantity>|<measure>" the source states ("2/3|cup", "1|tbsp"). */
function statedMeasures(sourceText: string): Set<string> {
  const stated = new Set<string>()
  for (const [, quantity, unit] of fractions(sourceText.toLowerCase()).matchAll(STATED_MEASURE)) {
    const measure = US_MEASURE.find((m) => m.en.test(unit))
    if (measure) stated.add(`${quantity}|${measure.key}`)
  }
  return stated
}

/**
 * A foreign source's ingredients, after the model localized them (#524 follow-up).
 * Two slips no prompt wording stopped (dry runs on howsweeteats):
 * - a US lean grade kept in the name ("najlepiej 94% chude") → "najlepiej chude";
 * - a weight turned into a household measure ("½ pound pasta" → alt "1/2 szklanki").
 *   A cup/spoon/stick `alt` stays only when the source states that number of
 *   cups/spoons/sticks; anything else is the model's own conversion.
 * Applies only to a source with US measures in it, so a German or French page,
 * which names cups differently, keeps what the model wrote.
 */
export function localizeForeignIngredients<T extends { name: string; alt: string }>(ingredients: T[], sourceText: string): T[] {
  const stated = statedMeasures(sourceText)
  return ingredients.map((ing) => {
    const name = ing.name.replace(/\d{2}(?:[,.]\d)?\s?%\s+(chud\p{L}*)/giu, '$1')
    const parts = stated.size > 0 ? fractions(ing.alt).trim().match(ALT_PARTS) : null
    const measure = parts && US_MEASURE.find((m) => m.pl.test(parts[2]))
    const madeUp = parts != null && measure != null && !stated.has(`${parts[1].replace(',', '.')}|${measure.key}`)
    return { ...ing, name, alt: madeUp ? '' : ing.alt }
  })
}
