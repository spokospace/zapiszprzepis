import { recipesNoun } from '@/app/components/app-menu-model'

/**
 * Plain-language copy for the notifications page (E01-S15, handoff §5). The
 * extraction pipeline writes `recipe_shares.error_message` for two audiences:
 * the Facebook / LLM strings are already Polish and say what to do next, the
 * rest are developer messages (`Firecrawl failed: HTTP 403 Forbidden`,
 * `OpenAI failed: …`). The raw text is never shown — it can carry upstream
 * detail — so every message resolves to one of these sentences, or passes
 * through when it is already written for the reader.
 */

export const REASON_NO_RECIPE = 'Na tej stronie nie znaleźliśmy przepisu.'
export const REASON_NOT_RESPONDING = 'Strona nie odpowiada. Spróbuj za chwilę.'
export const REASON_BLOCKED = 'Strona nie pozwoliła nam pobrać przepisu.'
export const REASON_GENERIC = 'Nie udało się dodać przepisu. Spróbuj ponownie.'

/** First match wins; the patterns pin the strings in src/inngest/run-extract-recipe.ts and the add/share actions. */
const RULES: ReadonlyArray<{ test: RegExp; text: string }> = [
  // 429 (rate limit) is temporary, not the site refusing us.
  { test: /^Firecrawl failed: HTTP 4(?!29)\d\d/, text: REASON_BLOCKED },
  { test: /^Firecrawl failed|timed? ?out|fetch failed/i, text: REASON_NOT_RESPONDING },
  {
    test: /^No recipe title extracted|^Extracted content has no usable recipe|^Scraped page had no readable recipe content/,
    text: REASON_NO_RECIPE,
  },
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

/** Only http(s) links are rendered as links — a `javascript:` / `data:` URL stays inert text. */
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/** "aniagotuje.pl" for a share card, never the whole address; only http(s) URLs name a site. */
export function shareDomain(url: string): string {
  try {
    if (!isHttpUrl(url)) return 'nieznana strona'
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'nieznana strona'
  }
}

/** "1 przepis wymaga uwagi", "2 przepisy wymagają uwagi", "5 przepisów wymaga uwagi". */
export function attentionLabel(n: number): string {
  const noun = recipesNoun(n)
  return `${n} ${noun} ${noun === 'przepisy' ? 'wymagają' : 'wymaga'} uwagi`
}

const ZONE = 'Europe/Warsaw'
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const clock = new Intl.DateTimeFormat('pl-PL', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' })
const dayMonth = new Intl.DateTimeFormat('pl-PL', { timeZone: ZONE, day: 'numeric', month: 'long' })

/** "przed chwilą", "dziś o 9:40", "wczoraj o 18:12", else "14 października" — in Polish time. */
export function notificationTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  if (now.getTime() - at.getTime() < 2 * 60 * 1000) return 'przed chwilą'
  const day = dayKey.format(at)
  if (day === dayKey.format(now)) return `dziś o ${clock.format(at)}`
  if (day === dayKey.format(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return `wczoraj o ${clock.format(at)}`
  return dayMonth.format(at)
}
