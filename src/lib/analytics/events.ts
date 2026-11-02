import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'

/** Events the usage counter accepts. Mirrors the CHECK in usage_counters. */
export const USAGE_EVENTS = ['recipe_view', 'category_view', 'timer_start', 'print', 'favorite_add'] as const
export type UsageEvent = (typeof USAGE_EVENTS)[number]

/** A recipe slug is lowercase ASCII words joined by single hyphens (see slugify). */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_SUBJECT_LENGTH = 120

/** The beacon body is two short strings; anything bigger is not ours. */
export const MAX_BODY_BYTES = 256

const CATEGORY_KEYS: ReadonlySet<string> = new Set(RECIPE_CATEGORIES.map((c) => c.value))

/** Crawlers, preview fetchers and headless browsers that do run scripts. */
const BOT_UA_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|phantom|facebookexternalhit|curl|wget/i

export function isBotUserAgent(userAgent: string | null): boolean {
  return userAgent !== null && BOT_UA_RE.test(userAgent)
}

/**
 * The (event, subject) of a beacon body, or null when it is not exactly one
 * allowlisted event with a well-formed subject. A category view must name a
 * known category; the other events name a recipe slug (existence is not checked
 * here: unknown slugs are ignored when the counters are read).
 */
export function parseUsageEvent(raw: string): { event: UsageEvent; subject: string } | null {
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof body !== 'object' || body === null) return null
  const { e, s } = body as Record<string, unknown>
  if (typeof e !== 'string' || typeof s !== 'string') return null
  if (!(USAGE_EVENTS as readonly string[]).includes(e)) return null
  if (s.length === 0 || s.length > MAX_SUBJECT_LENGTH) return null
  const event = e as UsageEvent
  if (event === 'category_view') return CATEGORY_KEYS.has(s) ? { event, subject: s } : null
  return SLUG_RE.test(s) ? { event, subject: s } : null
}

/** Is collection switched on? Off by default; the owner enables it after approving the policy text. */
export function usageAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USAGE_ANALYTICS === '1'
}
