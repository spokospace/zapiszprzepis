/**
 * Tags: extra, overlapping labels on top of the one category (an occasion, a
 * pastry type, a leading ingredient). The list is CLOSED on purpose — letting
 * the LLM coin tags yields "majonezowe" / "z majonezem" / "sałatka majonezowa"
 * side by side, which no filter can use. Add a tag here when one is missing;
 * anything the LLM returns outside this list is dropped.
 *
 * Values are ASCII slugs (stored in recipes.tags), labels carry the Polish
 * diacritics — same split as recipe-categories.ts.
 */
// `hint` is what the LLM is told the tag means — the bar a recipe must clear.
export const RECIPE_TAGS = [
  // Okazje
  { value: 'boze-narodzenie', label: 'Boże Narodzenie', hint: 'a traditional Christmas / Wigilia dish, or the source says so' },
  { value: 'wielkanoc', label: 'Wielkanoc', hint: 'a traditional Easter dish, or the source says so' },
  { value: 'tlusty-czwartek', label: 'Tłusty czwartek', hint: 'pączki, faworki / chrust, oponki' },
  { value: 'grill', label: 'grill', hint: 'cooked on a grill / barbecue' },
  { value: 'impreza', label: 'impreza', hint: 'party food: finger food, a big platter, the source says so' },
  { value: 'dla-dzieci', label: 'dla dzieci', hint: 'the source presents it as food for children' },
  // Ciasto i technika
  { value: 'kruche', label: 'kruche', hint: 'shortcrust: a crumbly dough of flour and cold butter, e.g. kruche ciasteczka, tarta, mazurek; NOT bread rolls or yeast dough' },
  { value: 'maslane', label: 'maślane', hint: 'butter is the defining ingredient (butter cookies, maślane bułeczki)' },
  { value: 'drozdzowe', label: 'drożdżowe', hint: 'leavened with yeast (drożdże)' },
  { value: 'biszkoptowe', label: 'biszkoptowe', hint: 'built on a sponge cake (biszkopt) or ladyfingers (biszkopty)' },
  { value: 'francuskie', label: 'francuskie', hint: 'made with puff pastry (ciasto francuskie)' },
  { value: 'bez-pieczenia', label: 'bez pieczenia', hint: 'a cake or dessert that needs no oven' },
  { value: 'na-zimno', label: 'na zimno', hint: 'set in the fridge (sernik na zimno, galaretka) or served cold' },
  { value: 'smazone', label: 'smażone', hint: 'deep- or pan-fried as the main technique' },
  // Smak i składnik wiodący
  { value: 'majonezowe', label: 'majonezowe', hint: 'mayonnaise is a main ingredient or binds the dish (salads, spreads)' },
  { value: 'musztardowe', label: 'musztardowe', hint: 'mustard is a main flavour, not a teaspoon in a dressing' },
  { value: 'czekoladowe', label: 'czekoladowe', hint: 'chocolate or cocoa is a main flavour' },
  { value: 'owocowe', label: 'owocowe', hint: 'fruit is a main ingredient' },
  { value: 'z-twarogiem', label: 'z twarogiem', hint: 'twaróg / ser biały is a main ingredient' },
  { value: 'miesne', label: 'mięsne', hint: 'meat or poultry is a main ingredient' },
  { value: 'rybne', label: 'rybne', hint: 'fish or seafood is a main ingredient' },
  { value: 'warzywne', label: 'warzywne', hint: 'vegetables are the main ingredient' },
  // Dieta
  { value: 'wegetarianskie', label: 'wegetariańskie', hint: 'a savoury dish with no meat, poultry or fish' },
  { value: 'weganskie', label: 'wegańskie', hint: 'no animal products at all (no meat, fish, eggs, dairy, honey)' },
  { value: 'bez-glutenu', label: 'bez glutenu', hint: 'no wheat, rye, barley or regular oats' },
  // Czas i trud
  // Computed from the times (see resolveTags), never offered to the LLM.
  { value: 'szybkie', label: 'szybkie', hint: null },
  { value: 'jednogarnkowe', label: 'jednogarnkowe', hint: 'cooked in a single pot or pan' },
] as const

export type RecipeTag = (typeof RECIPE_TAGS)[number]['value']

const TAG_VALUES = new Set<string>(RECIPE_TAGS.map((t) => t.value))

export function isRecipeTag(value: string): value is RecipeTag {
  return TAG_VALUES.has(value)
}

export function tagLabel(value: string): string {
  return RECIPE_TAGS.find((t) => t.value === value)?.label ?? value
}

/** "Szybkie" is arithmetic, not judgement: computed from the times, never
 *  taken from the LLM. */
const QUICK_MAX_MINUTES = 30
const COMPUTED_TAGS = new Set<string>(RECIPE_TAGS.filter((t) => t.hint == null).map((t) => t.value))

/** The tags the LLM may choose from, each with the meaning it is told. */
export const LLM_TAGS = RECIPE_TAGS.filter((t): t is Extract<(typeof RECIPE_TAGS)[number], { hint: string }> => t.hint != null)

/** How many tags a recipe carries at most — enough to describe it, few
 *  enough that each one still means something. */
export const MAX_TAGS = 6

// A tag the title names outright is not up to the LLM: "Bardzo kruche
// ciastka" is `kruche`, full stop. Only the unambiguous word forms — "maślanka"
// (buttermilk) must not read as `maslane`, nor "tosty francuskie" as puff pastry.
// Patterns match a word START (and, where given, a whole word) in the
// lowercased title; `\b` is ASCII-only in JS and misses "ś…" / "…ą", hence
// the \p{L} lookarounds.
function wordStart(source: string, wholeWord = false): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${source})${wholeWord ? '(?!\\p{L})' : ''}`, 'u')
}

const TITLE_TAG_PATTERNS: [RecipeTag, RegExp][] = [
  ['kruche', wordStart('kruch(?:e|y|a|ych|ymi|ego|ej)', true)],
  ['maslane', wordStart('maślan(?:e|y|a|ych|ymi|ego|ej)', true)],
  ['drozdzowe', wordStart('drożdżow')],
  ['biszkoptowe', wordStart('biszkopt')],
  ['bez-pieczenia', wordStart('bez pieczenia', true)],
  ['na-zimno', wordStart('na zimno', true)],
  ['majonezowe', wordStart('majonez')],
  ['musztardowe', wordStart('musztard')],
  ['czekoladowe', wordStart('czekolad')],
  ['z-twarogiem', wordStart('twaro|sernik')],
  ['wegetarianskie', wordStart('wegetaria')],
  ['weganskie', wordStart('wegańsk|wegan')],
  ['bez-glutenu', wordStart('bezglutenow|bez glutenu')],
  ['boze-narodzenie', wordStart('wigili|bożonarodzeniow')],
  ['wielkanoc', wordStart('wielkanoc')],
  ['tlusty-czwartek', wordStart('pącz|faworki|chrust')],
  ['grill', wordStart('grill')],
  ['jednogarnkowe', wordStart('jednogarnkow')],
]

export interface TagInput {
  title: string
  tags?: unknown
  prepTimeMinutes?: number | null
  cookTimeMinutes?: number | null
  totalTimeMinutes?: number | null
}

/**
 * The tags to store for a recipe: the ones its title names, "szybkie" when
 * the times say so, then the LLM's picks — restricted to the closed list,
 * deduplicated and capped at MAX_TAGS. Forced tags go first so the cap never
 * cuts them.
 */
export function resolveTags({ title, tags, prepTimeMinutes, cookTimeMinutes, totalTimeMinutes }: TagInput): RecipeTag[] {
  const result = new Set<RecipeTag>()
  const lowerTitle = title.toLocaleLowerCase('pl')
  for (const [tag, re] of TITLE_TAG_PATTERNS) {
    if (re.test(lowerTitle)) result.add(tag)
  }

  // Total includes passive time (rising, chilling); without it, prep + cook is
  // the best lower bound, and only counts when both are known.
  const minutes =
    totalTimeMinutes ?? (prepTimeMinutes != null && cookTimeMinutes != null ? prepTimeMinutes + cookTimeMinutes : null)
  if (minutes != null && minutes > 0 && minutes <= QUICK_MAX_MINUTES) result.add('szybkie')

  if (Array.isArray(tags)) {
    for (const raw of tags) {
      const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
      if (TAG_VALUES.has(value) && !COMPUTED_TAGS.has(value)) result.add(value as RecipeTag)
    }
  }

  return [...result].slice(0, MAX_TAGS)
}

// Polish inflects, so "rowkami" / "rowkach" or "truskawkowy" / "truskawkową"
// are the same word for this purpose: compare the first few letters.
const STEM_LENGTH = 5

export function stems(text: string): string[] {
  return (text.toLocaleLowerCase('pl').match(/\p{L}{4,}/gu) ?? []).map((w) => w.slice(0, STEM_LENGTH))
}

/**
 * The LLM's distinguishing note, or null when it gave nothing usable. A note
 * only earns its line by saying what the title doesn't, and the LLM keeps
 * echoing the title anyway ("Ciasteczka z rowkami" → "z charakterystycznymi
 * rowkami"), so every comma-separated part that repeats a title word is
 * dropped. Kept short: it renders on one line under the title on a card.
 */
export function resolveDescription(raw: unknown, title: string): string | null {
  if (typeof raw !== 'string') return null
  const titleStems = new Set(stems(title))
  const text = raw
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim().replace(/[.;]+$/, ''))
    .filter((part) => part.length > 0 && !stems(part).some((s) => titleStems.has(s)))
    .join(', ')
  return text.length > 0 && text.length <= 80 ? text : null
}
