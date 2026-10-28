import { describe, it, expect, vi } from 'vitest'
import { buildExtractEvent, listImports, mapImportRow, parseImportFilter, parseRetryPayload, IMPORTS_PAGE_SIZE } from './imports'

const USER = '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b'

const row = (over: Record<string, unknown> = {}) => ({
  share_id: 7,
  user_id: USER,
  username: 'ola',
  display_name: 'Ola',
  shared_url: 'https://blog.example/sernik',
  status: 'failed',
  error_message: 'Nie udało się',
  attempts: 3,
  created_at: '2026-10-27T10:00:00Z',
  updated_at: '2026-10-27T10:05:00Z',
  recipe_id: null,
  stuck: false,
  ...over,
})

describe('mapImportRow', () => {
  it('maps a failed share', () => {
    expect(mapImportRow(row())).toMatchObject({ id: 7, status: 'failed', attempts: 3, recipeId: null, stuck: false })
  })

  it('rejects an unknown status or a malformed row', () => {
    expect(mapImportRow(row({ status: 'processing' }))).toBeNull()
    expect(mapImportRow(row({ share_id: 0 }))).toBeNull()
    expect(mapImportRow(row({ user_id: 'x' }))).toBeNull()
    expect(mapImportRow(null)).toBeNull()
  })
})

describe('parseImportFilter', () => {
  it('defaults to the problem list for anything unknown', () => {
    expect(parseImportFilter(undefined)).toBe('problem')
    expect(parseImportFilter('drop table')).toBe('problem')
    expect(parseImportFilter('completed')).toBe('completed')
  })
})

describe('listImports', () => {
  it('returns a cursor only when a further page exists', async () => {
    const rows = Array.from({ length: IMPORTS_PAGE_SIZE + 1 }, (_, i) => row({ share_id: 100 - i }))
    const supabase = { rpc: vi.fn(async () => ({ data: rows, error: null })) } as never
    const page = await listImports(supabase, { filter: 'failed' })
    expect(page!.imports).toHaveLength(IMPORTS_PAGE_SIZE)
    expect(page!.nextBeforeId).toBe(100 - (IMPORTS_PAGE_SIZE - 1))
  })

  it('is null when the database refuses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = { rpc: vi.fn(async () => ({ data: null, error: { message: 'forbidden' } })) } as never
    expect(await listImports(supabase, { filter: 'problem' })).toBeNull()
  })
})

describe('retry payload and event', () => {
  const payload = {
    shareId: 7,
    sharedUrl: 'https://blog.example/sernik',
    sharedTitle: 'Sernik',
    sharedText: null,
    userId: USER,
  }

  it('parses what admin_retry_import returns', () => {
    expect(parseRetryPayload(payload)).toEqual(payload)
    expect(parseRetryPayload({ ...payload, shareId: 'x' })).toBeNull()
    expect(parseRetryPayload(null)).toBeNull()
  })

  it('builds the recipe/extract event unchanged in shape: the original sharer, URL and source type', () => {
    expect(buildExtractEvent(payload)).toEqual({
      name: 'recipe/extract',
      data: {
        shareId: 7,
        sharedUrl: 'https://blog.example/sernik',
        sharedTitle: 'Sernik',
        sharedText: undefined,
        sourceType: 'web_blog',
        userId: USER,
      },
    })
  })

  it('detects a Facebook link as facebook_text, like the owner flow', () => {
    const event = buildExtractEvent({ ...payload, sharedUrl: 'https://www.facebook.com/groups/1/posts/2' })
    expect(event.data.sourceType).toBe('facebook_text')
  })
})
