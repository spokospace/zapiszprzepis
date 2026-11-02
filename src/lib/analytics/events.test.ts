import { describe, it, expect } from 'vitest'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { slugify } from '@/lib/slugify'
import { isBotUserAgent, parseUsageEvent, USAGE_EVENTS } from './events'

const body = (e: unknown, s: unknown) => JSON.stringify({ e, s })

describe('parseUsageEvent', () => {
  it('accepts every recipe event with a recipe slug', () => {
    for (const event of USAGE_EVENTS.filter((e) => e !== 'category_view')) {
      expect(parseUsageEvent(body(event, 'szarlotka-babci'))).toEqual({ event, subject: 'szarlotka-babci' })
    }
  })

  it('accepts a category view for every known category and nothing else', () => {
    for (const { value } of RECIPE_CATEGORIES) {
      expect(parseUsageEvent(body('category_view', value))).toEqual({ event: 'category_view', subject: value })
    }
    expect(parseUsageEvent(body('category_view', 'nie-ma-takiej'))).toBeNull()
  })

  it('accepts what slugify produces, including a numbered suffix and the longest slug', () => {
    expect(parseUsageEvent(body('recipe_view', slugify('Żurek śląski')))).not.toBeNull()
    expect(parseUsageEvent(body('recipe_view', 'sernik-2'))).not.toBeNull()
    expect(parseUsageEvent(body('recipe_view', 'a'.repeat(100)))).not.toBeNull()
  })

  it('rejects an event outside the allowlist, including ingredient_check', () => {
    expect(parseUsageEvent(body('ingredient_check', 'sernik'))).toBeNull()
    expect(parseUsageEvent(body('drop table', 'sernik'))).toBeNull()
  })

  it('rejects malformed subjects', () => {
    for (const s of ['', 'Sernik', 'sernik_babci', '-sernik', 'sernik-', 'ser--nik', 'sernik babci', 'a'.repeat(121), '../x']) {
      expect(parseUsageEvent(body('recipe_view', s))).toBeNull()
    }
  })

  it('rejects non-string fields, extra shapes and non-JSON', () => {
    expect(parseUsageEvent(body(1, 'sernik'))).toBeNull()
    expect(parseUsageEvent(body('recipe_view', 5))).toBeNull()
    expect(parseUsageEvent('null')).toBeNull()
    expect(parseUsageEvent('[]')).toBeNull()
    expect(parseUsageEvent('not json')).toBeNull()
  })
})

describe('isBotUserAgent', () => {
  it('flags crawlers, previews and headless browsers', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 HeadlessChrome/120.0',
      'Mozilla/5.0 (Linux; Android 11) Chrome-Lighthouse',
      'facebookexternalhit/1.1',
    ]) {
      expect(isBotUserAgent(ua)).toBe(true)
    }
  })

  it('lets ordinary browsers through, and treats a missing User-Agent as not a bot', () => {
    expect(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')).toBe(false)
    expect(isBotUserAgent(null)).toBe(false)
  })
})
