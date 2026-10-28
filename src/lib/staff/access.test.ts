import { describe, it, expect } from 'vitest'
import { mapCodeRow, parseCodeForm } from './access'

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [k, v] of Object.entries(fields)) data.set(k, v)
  return data
}

const NOW = new Date('2026-10-28T12:00:00Z')

describe('parseCodeForm', () => {
  it('accepts a plain request with the defaults', () => {
    expect(parseCodeForm(form({}), NOW)).toEqual({ note: null, maxUses: 1, expiresAt: null })
  })

  it('trims the note and ends the expiry day at 23:59:59 UTC', () => {
    expect(parseCodeForm(form({ note: '  rodzina ', maxUses: '5', expires: '2026-12-31' }), NOW)).toEqual({
      note: 'rodzina',
      maxUses: 5,
      expiresAt: '2026-12-31T23:59:59.000Z',
    })
  })

  it.each([
    ['zero uses', { maxUses: '0' }],
    ['too many uses', { maxUses: '1001' }],
    ['a fractional count', { maxUses: '1.5' }],
    ['text for a count', { maxUses: 'dużo' }],
    ['a note over 200 characters', { note: 'x'.repeat(201) }],
    ['an expiry in the past', { expires: '2026-10-01' }],
    ['an expiry that is not a date', { expires: 'jutro' }],
    ['an impossible date', { expires: '2026-02-31' }],
  ])('rejects %s', (_name, fields) => {
    expect(parseCodeForm(form(fields), NOW)).toBeNull()
  })
})

describe('mapCodeRow', () => {
  const row = {
    id: 4,
    note: null,
    max_uses: 3,
    use_count: 1,
    expires_at: null,
    created_at: '2026-10-20T10:00:00Z',
    state: 'active',
  }

  it('maps a code row and never carries a hash field', () => {
    const code = mapCodeRow({ ...row, code_hash: 'abc' })
    expect(code).toEqual({
      id: 4, note: null, maxUses: 3, useCount: 1, expiresAt: null, createdAt: '2026-10-20T10:00:00Z', state: 'active',
    })
    expect(JSON.stringify(code)).not.toContain('abc')
  })

  it('rejects an unknown state', () => {
    expect(mapCodeRow({ ...row, state: 'revoked' })).toBeNull()
  })
})
