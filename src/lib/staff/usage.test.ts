import { describe, it, expect, vi } from 'vitest'
import {
  formatCount,
  formatDay,
  isEmptySummary,
  loadUsageSummary,
  mapUsageSummary,
  usageCsvFilename,
  usageSummaryCsv,
  type UsageSummary,
} from './usage'
import { parsePermissions } from './permissions'
import { visibleResources } from './registry'

describe('usageSummaryCsv', () => {
  const summary: UsageSummary = {
    days: 30,
    since: '2026-10-04',
    categories: [{ subject: 'zupy', views: 12, recipes: 30 }],
    recipes: [
      { slug: 'rosol', title: 'Rosół; "babci"', views: 9 },
      { slug: 'formula', title: '=HYPERLINK("x")', views: 2 },
    ],
    orphanViews: 4,
    features: { timer_start: 5, print: 3, favorite_add: 0 },
  }
  const lines = () => usageSummaryCsv(summary).replace(/^﻿/, '').trimEnd().split('\r\n')

  it('starts with a BOM and a header, one row per category, recipe, feature and the orphan total', () => {
    const csv = usageSummaryCsv(summary)
    expect(csv.startsWith('﻿sekcja;klucz;nazwa;liczba;przepisow_w_kategorii\r\n')).toBe(true)
    expect(lines()).toEqual([
      'sekcja;klucz;nazwa;liczba;przepisow_w_kategorii',
      'kategoria;zupy;Zupy;12;30',
      'przepis;rosol;"Rosół; ""babci""";9;',
      `przepis;formula;"'=HYPERLINK(""x"")";2;`,
      'funkcja;timer_start;Uruchomienia minutnika;5;',
      'funkcja;print;Wydruki przepisu;3;',
      'funkcja;favorite_add;Dodania do ulubionych;0;',
      'inne;orphan_views;Odsłony przepisów, których już nie ma pod tym adresem;4;',
    ])
  })

  it('names the file after the window and its first day', () => {
    expect(usageCsvFilename(summary)).toBe('statystyki-30-dni-od-2026-10-04.csv')
    expect(usageCsvFilename({ ...summary, since: 'x"; evil' })).toBe('statystyki-30-dni-od-brak-daty.csv')
  })
})

const doc = {
  days: 7,
  since: '2026-10-27',
  categories: [{ subject: 'zupy', views: '12', recipes: 30 }, { subject: 5 }],
  recipes: [{ slug: 'rosol', title: 'Rosół', views: 9 }, { slug: 'x', views: 1 }],
  orphan_views: 4,
  features: [{ event: 'print', count: 3 }, { event: 'bogus', count: 99 }],
}

describe('mapUsageSummary', () => {
  it('shapes the RPC document and fills every feature counter', () => {
    expect(mapUsageSummary(doc)).toEqual({
      days: 7,
      since: '2026-10-27',
      categories: [{ subject: 'zupy', views: 12, recipes: 30 }],
      recipes: [{ slug: 'rosol', title: 'Rosół', views: 9 }, { slug: 'x', title: 'x', views: 1 }],
      orphanViews: 4,
      features: { timer_start: 0, print: 3, favorite_add: 0 },
    })
  })

  it('rejects anything that is not the document', () => {
    expect(mapUsageSummary(null)).toBeNull()
    expect(mapUsageSummary('x')).toBeNull()
    expect(mapUsageSummary({ days: 7 })).toBeNull()
  })
})

describe('empty state', () => {
  it('an empty table maps to an empty summary', () => {
    const s = mapUsageSummary({ days: 30, since: '2026-10-04', categories: [], recipes: [], orphan_views: 0, features: [] })!
    expect(isEmptySummary(s)).toBe(true)
  })

  it('any count makes it non-empty', () => {
    expect(isEmptySummary(mapUsageSummary(doc)!)).toBe(false)
    const onlyOrphans = mapUsageSummary({ days: 7, since: '2026-10-27', orphan_views: 2 })!
    expect(isEmptySummary(onlyOrphans)).toBe(false)
  })
})

describe('formatting', () => {
  it('groups thousands in Polish', () => {
    expect(formatCount(12345).replace(/\s/g, ' ')).toBe('12 345')
  })

  it('formats a day and leaves junk alone', () => {
    expect(formatDay('2026-10-27')).toMatch(/2026/)
    expect(formatDay('nope')).toBe('nope')
  })
})

describe('loadUsageSummary', () => {
  it('asks for the window and returns the shaped summary', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: doc, error: null })
    const s = await loadUsageSummary({ rpc } as never, 7)
    expect(rpc).toHaveBeenCalledWith('admin_usage_summary', { p_days: 7 })
    expect(s?.orphanViews).toBe(4)
  })

  it('returns null when the RPC fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'forbidden' } })
    expect(await loadUsageSummary({ rpc } as never, 7)).toBeNull()
  })
})

describe('analytics.read gate', () => {
  it('shows Statystyki to a holder of analytics.read and hides it from a moderator', () => {
    expect(visibleResources(parsePermissions(['analytics.read'])).map((r) => r.name)).toEqual(['analytics'])
    expect(visibleResources(parsePermissions(['recipes.read', 'imports.read'])).map((r) => r.name)).not.toContain('analytics')
  })
})
