// Whether a recipe's source text is Polish (#524). A foreign source gets extra
// localization rules and a stronger model; read from the text itself, since every
// source path (Firecrawl, Jina, Blogger feed, Facebook caption, YouTube) has one,
// and many Polish blogs ship an `en-US` theme `<html lang>`.

export type SourceLanguage = 'pl' | 'foreign'

/** The extraction model for a Polish source. */
export const EXTRACTION_MODEL = 'gpt-4o-mini'
/** The model for a foreign source. Not LABEL_MODEL, so the labelling call is
 *  still told apart by its model. */
export const FOREIGN_EXTRACTION_MODEL = 'gpt-4.1-mini'

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

/** Appended to the extraction prompt for a foreign source only. */
export const FOREIGN_SOURCE_RULES = `
The source is NOT in Polish. Localize it for a cook in Poland:
- Translate EVERY word to Polish, including preparation notes and asides in steps ("finely grated" → "drobno starty", "chunky guac" → "guacamole z kawałkami awokado"). No English word may remain except proper names.
- Use natural Polish culinary phrasing, not word-for-word: "ground turkey/beef/pork" → "mięso mielone z indyka" / "mielona wołowina" / "mięso mielone wieprzowe"; "a splash" → "odrobina"; "kosher salt" → "sól"; "all-purpose flour" → "mąka pszenna".
- Convert every US unit: pounds and ounces to grams (1 lb ≈ 450 g, 1 oz ≈ 28 g), fluid ounces and quarts to ml, sticks of butter to grams (1 stick ≈ 113 g), °F to °C (350°F → 180°C) — in steps too, and say "°C".
- "alt" holds only a Polish household measure ("1 szklanka", "2 łyżki", "1/2 kostki"); never pounds, ounces or any English word there. This overrides the "alt" rule above: write stated cups, sticks and spoons as szklanki, kostki and łyżki. A preparation note goes into "name" ("szalotka drobno starta"), not "alt".
- Brands: when the brand IS the dish (a homemade copy, "Homemade SpaghettiOs"), keep the brand with its own spelling in the title ("Domowe SpaghettiOs z chrupiącym manchego") and keep the title short. When a branded product is an INGREDIENT (Crisco, Old Bay, Ro-Tel), name the generic Polish product instead ("tłuszcz roślinny do pieczenia").
Examples (wrong → right): {"name": "mielone indyka", "amount": "450", "unit": "g", "alt": "1 funt"} → {"name": "mięso mielone z indyka", "amount": "450", "unit": "g", "alt": ""}; {"name": "szalotka", "amount": "1", "alt": "finely grated"} → {"name": "szalotka drobno starta", "amount": "1", "alt": ""}; {"name": "ser burrata", "amount": "225", "unit": "g", "alt": "8 uncji"} → {"name": "ser burrata", "amount": "225", "unit": "g", "alt": ""}.`
