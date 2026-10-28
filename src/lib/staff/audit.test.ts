import { describe, it, expect, vi } from 'vitest'
import { AUDIT_PAGE_SIZE, describePayload, listAudit, mapAuditRow, parseAuditFilters, sanitizePayload } from './audit'

const ACTOR = '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b'

describe('sanitizePayload — no e-mail or secret can reach the screen', () => {
  it('drops forbidden keys at the top level and when nested', () => {
    expect(sanitizePayload({ blocked: true, email: 'a@b.c', nested: { Email: 'x', ok: 1, token: 't' } })).toEqual({
      blocked: true,
      nested: { ok: 1 },
    })
  })

  it('cleans objects inside arrays', () => {
    expect(sanitizePayload([{ code: 'ABCD', id: 1 }])).toEqual([{ id: 1 }])
  })

  it('leaves primitives and null alone', () => {
    expect(sanitizePayload(null)).toBeNull()
    expect(sanitizePayload('x')).toBe('x')
    expect(sanitizePayload(3)).toBe(3)
  })
})

describe('describePayload', () => {
  it('prints key: value pairs without forbidden keys', () => {
    expect(describePayload({ blocked: true, reason: 'spam', email: 'a@b.c' })).toBe('blocked: true, reason: spam')
  })

  it('prints a dash for nothing', () => {
    expect(describePayload(null)).toBe('—')
    expect(describePayload({})).toBe('—')
    expect(describePayload({ email: 'a@b.c' })).toBe('—')
  })

  it('prints nested values as JSON', () => {
    expect(describePayload({ roles: ['admin'] })).toBe('roles: ["admin"]')
  })
})

describe('mapAuditRow', () => {
  const row = {
    id: 9, actor_id: ACTOR, via: 'panel', resource: 'users', operation: 'block',
    target_id: ACTOR, before: { blocked: false }, after: { blocked: true }, created_at: '2026-10-28T10:00:00Z',
  }

  it('maps a row', () => {
    expect(mapAuditRow(row)).toMatchObject({ id: 9, via: 'panel', operation: 'block', after: { blocked: true } })
  })

  it('rejects an unknown channel or a malformed actor', () => {
    expect(mapAuditRow({ ...row, via: 'cron' })).toBeNull()
    expect(mapAuditRow({ ...row, actor_id: 'x' })).toBeNull()
  })
})

describe('parseAuditFilters', () => {
  it('keeps valid filters', () => {
    expect(parseAuditFilters({ resource: 'users', actor: ACTOR, from: '2026-10-01', to: '2026-10-28', before: '40' })).toEqual({
      resource: 'users', actor: ACTOR, from: '2026-10-01', to: '2026-10-28', beforeId: 40,
    })
  })

  it('drops anything the database function should not receive', () => {
    expect(parseAuditFilters({ resource: 'pg_shadow', actor: 'x', from: 'yesterday', to: '2026-13-45', before: '-2' })).toEqual({
      resource: null, actor: null, from: null, to: null, beforeId: null,
    })
  })
})

describe('listAudit', () => {
  it('turns a day range into whole UTC days and asks for one row more than a page', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }))
    await listAudit({ rpc } as never, { resource: 'users', actor: null, from: '2026-10-01', to: '2026-10-28', beforeId: null })
    expect(rpc).toHaveBeenCalledWith('admin_list_audit', {
      p_resource: 'users',
      p_filter_actor: null,
      p_from: '2026-10-01T00:00:00Z',
      p_to: '2026-10-29T00:00:00.000Z',
      p_limit: AUDIT_PAGE_SIZE + 1,
      p_before_id: null,
    })
  })

  it('is null when the database refuses (a moderator)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'forbidden' } }))
    expect(await listAudit({ rpc } as never, { resource: null, actor: null, from: null, to: null, beforeId: null })).toBeNull()
  })
})
