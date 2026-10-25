import { parseIngredients, ingredientLine } from '@/lib/ingredients'
import { parseSteps } from '@/lib/steps'
import { buildFallbackMetaDescription, tagLabel } from '@/lib/recipe-tags'
import { categoryLabel, type RecipeCategory } from '@/lib/recipe-categories'
import { servingsCount } from '@/lib/servings'
import { recipePath } from '@/lib/routes'
import { coverImageSrc } from '@/lib/recipe-image-archive'

/**
 * The guest-safe recipe fields the schema.org/Recipe JSON-LD needs — a subset of
 * a public_recipes row. Deliberately NO gallery, step photos or owner data: the
 * markup must describe only what an anonymous crawler (Googlebot is signed out)
 * actually sees on the page, so login-gated content never leaks into it.
 */
export interface RecipeForJsonLd {
  slug: string
  title: string
  description: string | null
  meta_description?: string | null
  /** The public cover (archived CDN URL). The gallery and step photos are NOT here. */
  image_url: string | null
  ingredients: unknown
  steps: unknown
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  servings: number | null
  category: RecipeCategory
  tags?: string[] | null
  /** The original recipe's author at the source — the Recipe's real author, not
   *  the platform user who added it (a curator, not the creator). */
  source_author?: string | null
  created_at: string
  /** coalesce(updated_at, created_at); falls back to created_at when absent. */
  last_modified?: string | null
}

/** Whole minutes → an ISO 8601 duration ("PT30M"), or null when not a positive number. */
function isoDuration(minutes: number | null | undefined): string | null {
  return typeof minutes === 'number' && minutes > 0 ? `PT${Math.round(minutes)}M` : null
}

/** An absolute image URL: kept as-is when already absolute, otherwise resolved against the site. */
function absoluteImage(imageUrl: string, siteUrl: string): string {
  return /^https?:\/\//i.test(imageUrl) ? imageUrl : `${siteUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`
}

/**
 * The schema.org/Recipe object for a recipe's detail page, ready to serialize
 * into a <script type="application/ld+json"> tag. Emits only fields we can fill
 * honestly from stored data.
 *
 * Google Search Console flags several non-critical "missing field" suggestions
 * for Recipe markup; none blocks rich results, and we deliberately decline every
 * one because the honest data does not exist (triaged in #493 — the recipe-json-ld
 * tests lock these omissions so a later edit cannot silently start emitting them):
 *   - NO aggregateRating / review — there is no ratings system, and Google
 *     forbids fabricated ratings (they are what render the SERP stars).
 *   - NO nutrition — not stored; estimating it would be invented data.
 *   - NO video — a VideoObject needs an uploadDate we do not store, even where a
 *     youtube_id exists; it would only raise a Search Console warning without
 *     adding to the Recipe result. (youtube_id is not even a builder input.)
 *   - NO recipeCuisine — there is no stored cuisine. `category` is a dish-type
 *     enum (obiady/zupy/desery...) and `tags` are free-form keywords; deriving or
 *     defaulting a cuisine (e.g. "Polish") would be invented data. Revisit only if
 *     a trustworthy cuisine field is ever stored.
 *   - NO image / video per recipeInstructions step — step photos are login-gated
 *     (visibleStepImages), and Googlebot is anonymous, so the markup must describe
 *     only what a signed-out visitor sees.
 * `keywords` IS emitted, but only from stored `tags` (a comma-separated list of
 * their labels). A recipe that resolves to NO tags — its title matches no
 * TITLE_TAG_PATTERNS, its times are not "szybkie", and the LLM picked nothing from
 * the closed list — emits no `keywords`, and Search Console then raises a
 * "Missing field keywords" suggestion for that page. We accept that omission (#530,
 * test-locked below): the closed tag list is the only honest keyword source, most
 * tagless recipes match nothing in it, and deriving a keyword from the title, from
 * recipeCategory (already emitted — Google's Recipe guidance forbids repeating a
 * category term as a keyword), or from ingredient names (that is recipeIngredient)
 * would invent data or duplicate an existing field.
 * prep/cook/total times are included even when estimated (`times_estimated`):
 * they are the approximations the page itself shows, and dropping them loses the
 * richest part of the snippet.
 */
export function buildRecipeJsonLd(recipe: RecipeForJsonLd, siteUrl: string): Record<string, unknown> {
  const url = `${siteUrl}${recipePath(recipe.slug)}`
  const description = recipe.meta_description ?? buildFallbackMetaDescription(recipe)

  // Metric quantity only — no household "alt" measure: search engines expect a
  // clean recipeIngredient quantity (#505).
  const ingredients = parseIngredients(recipe.ingredients)
    .map((ing) => ingredientLine(ing))
    .filter((line) => line.length > 0)
  const steps = parseSteps(recipe.steps)

  const prepTime = isoDuration(recipe.prep_time_minutes)
  const cookTime = isoDuration(recipe.cook_time_minutes)
  const totalTime = isoDuration(recipe.total_time_minutes)

  const author = recipe.source_author?.trim()
  const keywords = (recipe.tags ?? []).map(tagLabel).filter(Boolean).join(', ')
  // Only an archived Storage cover, never a legacy external link (the image_url
  // invariant) — the markup must not point crawlers at a third-party host.
  const cover = coverImageSrc(recipe.image_url)
  const image = cover ? absoluteImage(cover, siteUrl) : null

  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    url,
    mainEntityOfPage: url,
    inLanguage: 'pl-PL',
    ...(image ? { image: [image] } : {}),
    description,
    recipeCategory: categoryLabel(recipe.category),
    datePublished: recipe.created_at,
    dateModified: recipe.last_modified ?? recipe.created_at,
    ...(author ? { author: { '@type': 'Person', name: author } } : {}),
    ...(keywords ? { keywords } : {}),
    ...(recipe.servings ? { recipeYield: servingsCount(recipe.servings) } : {}),
    ...(prepTime ? { prepTime } : {}),
    ...(cookTime ? { cookTime } : {}),
    ...(totalTime ? { totalTime } : {}),
    ...(ingredients.length ? { recipeIngredient: ingredients } : {}),
    ...(steps.length ? { recipeInstructions: steps.map((text) => ({ '@type': 'HowToStep', text })) } : {}),
  }
}

// The HTML-significant characters that must never appear raw inside a <script>
// body: < and > (could open/close a tag), & (entity start), and the line/paragraph
// separators U+2028/U+2029 (valid JSON, but they break an inline script's parse).
// Built from char codes so this source file stays pure ASCII.
const SCRIPT_UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, 'g')

/**
 * Serialize a JSON-LD object for safe inlining in a <script> tag. JSON.stringify
 * alone is not enough: a step or title containing "</script>" would close the tag
 * early, so every HTML-significant character is escaped as \uXXXX (still valid JSON).
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(SCRIPT_UNSAFE, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)
}
