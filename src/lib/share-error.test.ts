import { describe, it, expect } from 'vitest'
import {
  attentionLabel,
  explainShareError,
  isHttpUrl,
  REASON_BLOCKED,
  REASON_GENERIC,
  REASON_NO_RECIPE,
  REASON_OUR_SIDE,
  REASON_UNREADABLE,
  shareDomain,
} from '@/lib/share-error'

describe('explainShareError — the raw pipeline message is never shown', () => {
  it.each([
    ['Firecrawl failed: HTTP 403 Forbidden', REASON_BLOCKED],
    ['Firecrawl failed: HTTP 404', REASON_BLOCKED],
    ['Firecrawl failed: HTTP 429 Too Many Requests', REASON_OUR_SIDE],
    ['Firecrawl failed: HTTP 502 Bad Gateway', REASON_OUR_SIDE],
    ['OpenAI failed: HTTP 500 — upstream detail', REASON_OUR_SIDE],
    ['No response from OpenAI', REASON_OUR_SIDE],
    ['Failed to queue extraction', REASON_OUR_SIDE],
    ['fetch failed', REASON_OUR_SIDE],
    ['The operation timed out', REASON_OUR_SIDE],
    ['No recipe title extracted — source page may not contain a recipe', REASON_NO_RECIPE],
    ['Extracted content has no usable recipe (title present but no ingredients or steps)', REASON_NO_RECIPE],
    [
      'Scraped page had no readable recipe content (possible Google Translate interstitial or render failure)',
      REASON_UNREADABLE,
    ],
    ['Database insert failed: duplicate key value violates unique constraint', REASON_GENERIC],
    ['Share update failed: JWT expired', REASON_GENERIC],
  ])('maps %j to plain Polish', (message, expected) => {
    expect(explainShareError(message)).toBe(expected)
  })

  it.each([
    'Facebook nie udostępnia treści tego posta (autor wyłączył osadzanie) — skopiuj przepis ręcznie',
    'Nie udało się pobrać tego posta z Facebooka — spróbuj ponownie za chwilę',
    'Ten post na Facebooku nie ma opisu z przepisem ani linku do niego',
    'Nie udało się odczytać przepisu z odpowiedzi modelu — spróbuj ponownie',
    'Nie udało się ponowić przetwarzania. Spróbuj ponownie.',
  ])('passes reader-facing Polish through: %j', (message) => {
    expect(explainShareError(message)).toBe(message)
  })

  it('falls back to the generic sentence for an empty or unknown message', () => {
    expect(explainShareError(null)).toBe(REASON_GENERIC)
    expect(explainShareError('   ')).toBe(REASON_GENERIC)
    expect(explainShareError('TypeError: cannot read properties of undefined')).toBe(REASON_GENERIC)
  })
})

describe('shareDomain', () => {
  it('shows the host without www', () => {
    expect(shareDomain('https://www.aniagotuje.pl/przepis/sernik')).toBe('aniagotuje.pl')
    expect(shareDomain('http://m.facebook.com/x')).toBe('m.facebook.com')
  })

  it('never names a host for a non-http or broken URL', () => {
    expect(shareDomain('javascript:alert(1)')).toBe('nieznana strona')
    expect(shareDomain('not a url')).toBe('nieznana strona')
  })

  it('isHttpUrl only accepts http(s)', () => {
    expect(isHttpUrl('https://a.pl')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
  })
})

describe('attentionLabel — Polish plural', () => {
  it.each([
    [1, '1 przepis wymaga uwagi'],
    [2, '2 przepisy wymagają uwagi'],
    [4, '4 przepisy wymagają uwagi'],
    [5, '5 przepisów wymaga uwagi'],
    [12, '12 przepisów wymaga uwagi'],
    [14, '14 przepisów wymaga uwagi'],
    [22, '22 przepisy wymagają uwagi'],
    [25, '25 przepisów wymaga uwagi'],
    [112, '112 przepisów wymaga uwagi'],
  ])('%i → %s', (n, expected) => {
    expect(attentionLabel(n)).toBe(expected)
  })
})
