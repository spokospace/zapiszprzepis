import { recipesNoun } from '@/app/components/app-menu-model'

/**
 * Plain-language copy for the notifications page (E01-S15). The extraction
 * pipeline writes `recipe_shares.error_message` for two audiences: the
 * Facebook / LLM strings are already Polish and say what to do next, the rest
 * are developer messages (`Firecrawl failed: HTTP 403 Forbidden`, `OpenAI
 * failed: …`). The raw text is never shown — it can carry upstream detail —
 * so every message resolves to one of these sentences, or passes through when
 * it is already written for the reader.
 */

export const REASON_BLOCKED = 'Strona nie pozwoliła nam pobrać przepisu.'
export const REASON_OUR_SIDE = 'Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.'
export const REASON_NO_RECIPE = 'Na tej stronie nie znaleźliśmy przepisu (składników i kroków).'
export const REASON_UNREADABLE = 'Nie udało się odczytać przepisu z tej strony.'
export const REASON_GENERIC = 'Nie udało się zapisać przepisu. Spróbuj ponownie.'

/** First match wins; the patterns pin the strings in src/inngest/run-extract-recipe.ts and the add/share actions. */
const RULES: ReadonlyArray<{ test: RegExp; text: string }> = [
  // 429 (rate limit) is ours to retry, not the site refusing us.
  { test: /^Firecrawl failed: HTTP 4(?!29)\d\d/, text: REASON_BLOCKED },
  { test: /^(Firecrawl|OpenAI) failed|timed? ?out|fetch failed|Failed to queue extraction|No response from OpenAI/i, text: REASON_OUR_SIDE },
  { test: /^No recipe title extracted|^Extracted content has no usable recipe/, text: REASON_NO_RECIPE },
  { test: /^Scraped page had no readable recipe content/, text: REASON_UNREADABLE },
]

/** Already written for the reader: Polish diacritics, or a Polish sentence opener. */
const READER_FACING = /[ąćęłńóśźż]|^(Nie|Ten|Opis|Facebook) /i

export function explainShareError(message: string | null | undefined): string {
  const text = message?.trim()
  if (!text) return REASON_GENERIC
  const rule = RULES.find((r) => r.test.test(text))
  if (rule) return rule.text
  return READER_FACING.test(text) ? text : REASON_GENERIC
}

/** "aniagotuje.pl" for a share card; only http(s) URLs count as a known site. */
export function shareDomain(url: string): string {
  try {
    if (!isHttpUrl(url)) return 'nieznana strona'
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'nieznana strona'
  }
}

/** Only http(s) links are rendered as links — a `javascript:` / `data:` URL stays inert text. */
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/** "1 przepis wymaga uwagi", "2 przepisy wymagają uwagi", "5 przepisów wymaga uwagi". */
export function attentionLabel(n: number): string {
  const noun = recipesNoun(n)
  return `${n} ${noun} ${noun === 'przepisy' ? 'wymagają' : 'wymaga'} uwagi`
}
