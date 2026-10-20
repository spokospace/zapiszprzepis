const POLISH_TO_ASCII: Record<string, string> = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l',
  'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => POLISH_TO_ASCII[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100)
}

// A title with no Latin letters or digits (only emoji, say) slugifies to ''.
// A recipe's public URL is /przepis/{slug}, so it falls back to this word.
export const FALLBACK_RECIPE_SLUG = 'przepis'

export function recipeSlug(title: string): string {
  return slugify(title) || FALLBACK_RECIPE_SLUG
}

// Attempts 2 … NUMBERED_SLUG_ATTEMPTS take the lowest free numeric suffix (the
// backfill rule). Past that the title is popular enough that probing further
// only wastes inserts, so the suffix turns random and lands a free slug.
export const NUMBERED_SLUG_ATTEMPTS = 10

export function recipeSlugCandidate(base: string, attempt: number): string {
  if (attempt <= 1) return base
  if (attempt <= NUMBERED_SLUG_ATTEMPTS) return `${base}-${attempt}`
  return `${base}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`
}
