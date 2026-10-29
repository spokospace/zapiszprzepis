import { RECIPE_CATEGORIES, isRecipeCategory, type RecipeCategory } from '@/lib/recipe-categories'

/** Recipes per "Pokaż kolejne" step on /u/{username} (E01-S14). */
export const PROFILE_PAGE_SIZE = 12

/**
 * ?strona beyond this is clamped. The list asks for page × 12 + 1 rows in one
 * request and PostgREST returns at most 1000, so 83 (997 rows) is the deepest
 * page that is never silently truncated. The biggest profile already has
 * hundreds of recipes, so a lower cap would hide its oldest ones.
 */
export const MAX_PROFILE_PAGE = Math.floor((1000 - 1) / PROFILE_PAGE_SIZE)

/**
 * The shape the S18 username generator produces (lowercase ASCII words joined
 * by single hyphens). Checked before any query: anything else cannot exist, and
 * a NUL byte would make Postgres raise instead of returning "not found".
 */
const USERNAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isUsernameShape(raw: string): boolean {
  return raw.length <= 64 && USERNAME_RE.test(raw)
}

/** ?strona=N → an integer 1..MAX_PROFILE_PAGE; anything unparseable is page 1. */
export function parseProfilePage(raw: unknown): number {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return 1
  const page = Number(raw)
  return page < 1 ? 1 : Math.min(page, MAX_PROFILE_PAGE)
}

/** ?kategoria → a category the person actually has recipes in, else null (show all). */
export function parseProfileCategory(raw: unknown, available: readonly CategoryCount[]): RecipeCategory | null {
  if (typeof raw !== 'string' || !isRecipeCategory(raw)) return null
  return available.some((c) => c.value === raw) ? raw : null
}

export interface CategoryCount {
  value: RecipeCategory
  label: string
  count: number
}

/** Per-category recipe counts in RECIPE_CATEGORIES order, non-zero only; unknown values are dropped. */
export function categoryCounts(rows: readonly { category: string | null }[]): CategoryCount[] {
  const counts = new Map<string, number>()
  for (const { category } of rows) {
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return RECIPE_CATEGORIES.filter((c) => counts.has(c.value)).map((c) => ({ ...c, count: counts.get(c.value)! }))
}

// Genitive month names: "od października 2026" (Intl gives the nominative "październik").
const MONTHS_GENITIVE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
]

const MONTH_YEAR_WARSAW = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', month: 'numeric', year: 'numeric' })

/**
 * "października 2026" for "W aplikacji Zapisz Przepis od …". Uses the earlier of the
 * profile's creation and the person's oldest recipe: profiles.created_at is the
 * S18 backfill time for accounts that existed before S18, while their recipes
 * go back further. Approximate for a pre-S18 account without recipes.
 */
export function memberSinceLabel(profileCreatedAt: string, oldestRecipeCreatedAt?: string | null): string {
  const profile = new Date(profileCreatedAt)
  const recipe = oldestRecipeCreatedAt ? new Date(oldestRecipeCreatedAt) : null
  const since = recipe && recipe < profile ? recipe : profile
  // Europe/Warsaw, not the server's zone: a midnight-UTC date must not slip a month.
  const [month, year] = MONTH_YEAR_WARSAW.format(since)
    .split('/')
  return `${MONTHS_GENITIVE[Number(month) - 1]} ${year}`
}

/** The oldest created_at among the rows, or null for none. ISO timestamps compare as strings. */
export function oldestCreatedAt(rows: readonly { created_at: string }[]): string | null {
  return rows.reduce<string | null>((min, r) => (min === null || r.created_at < min ? r.created_at : min), null)
}

function profileBase(username: string): string {
  return `/u/${encodeURIComponent(username)}`
}

/** A category chip's link; null = "Wszystkie". */
export function profileCategoryHref(username: string, category: string | null): string {
  return category ? `${profileBase(username)}?kategoria=${encodeURIComponent(category)}` : profileBase(username)
}

/** "Pokaż kolejne": the same list one page longer, scrolled to the first new card. */
export function profileMoreHref(username: string, category: string | null, nextPage: number): string {
  const params = new URLSearchParams()
  if (category) params.set('kategoria', category)
  params.set('strona', String(nextPage))
  return `${profileBase(username)}?${params.toString()}#wiecej`
}

/** The owner block shows only to the signed-in owner of this profile. */
export function isProfileOwner(userId: string | null | undefined, profileId: string): boolean {
  return Boolean(userId) && userId === profileId
}

/** An empty profile is noindex (E01-S14 AC); one with recipes uses the site default. */
export function profileRobots(total: number): { index: false } | undefined {
  return total === 0 ? { index: false } : undefined
}

/** Profile header count, neutral: others never learn the person's gender (#376). */
export function profileCountLine(count: number): string {
  return `Dodane przepisy: ${count}`
}

/** A profile without recipes, neutral like the count line (#376). */
export const PROFILE_EMPTY_TEXT = 'Na tym profilu nie ma jeszcze przepisów.'
