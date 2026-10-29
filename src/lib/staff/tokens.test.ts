import { describe, it, expect } from 'vitest'
import { connectCommand, mapTokenRow, parseTokenForm } from './tokens'

const row = {
  id: 3, label: 'laptop', prefix: 'zpm_ab12', created_at: '2026-10-30T10:00:00Z',
  expires_at: '2027-01-28T10:00:00Z', last_used_at: null, revoked_at: null, state: 'active',
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [k, v] of Object.entries(fields)) data.set(k, v)
  return data
}

describe('mapTokenRow', () => {
  it('maps a row from admin_list_tokens', () => {
    expect(mapTokenRow(row)).toMatchObject({ id: 3, label: 'laptop', prefix: 'zpm_ab12', state: 'active', lastUsedAt: null })
  })

  it('drops rows with an unknown state or no label', () => {
    expect(mapTokenRow({ ...row, state: 'weird' })).toBeNull()
    expect(mapTokenRow({ ...row, label: '' })).toBeNull()
    expect(mapTokenRow(null)).toBeNull()
  })
})

describe('parseTokenForm', () => {
  it('trims the label and accepts the offered lifetimes only', () => {
    expect(parseTokenForm(form({ label: '  laptop ', days: '90' }))).toEqual({ label: 'laptop', days: 90 })
    expect(parseTokenForm(form({ label: 'x', days: '45' }))).toBeNull()
    expect(parseTokenForm(form({ label: '   ' }))).toBeNull()
    expect(parseTokenForm(form({ label: 'x'.repeat(81) }))).toBeNull()
  })

  it('defaults to 90 days', () => {
    expect(parseTokenForm(form({ label: 'x' }))?.days).toBe(90)
  })
})

describe('connectCommand', () => {
  it('builds the claude mcp add line for the site', () => {
    expect(connectCommand('https://zapiszprzepis.pl/', 'zpm_x')).toBe(
      'claude mcp add --transport http zapiszprzepis https://zapiszprzepis.pl/api/mcp --header "Authorization: Bearer zpm_x"',
    )
  })
})
