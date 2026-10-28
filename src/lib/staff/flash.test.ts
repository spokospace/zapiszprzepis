import { describe, it, expect } from 'vitest'
import { flashPath, readFlash } from './flash'

describe('flashPath', () => {
  it('appends a success key', () => {
    expect(flashPath('/admin/uzytkownicy', { ok: 'blocked' })).toBe('/admin/uzytkownicy?ok=blocked')
  })

  it('replaces an earlier outcome and keeps the rest of the query', () => {
    expect(flashPath('/admin/uzytkownicy?q=ola&error=forbidden', { ok: 'deleted' })).toBe(
      '/admin/uzytkownicy?q=ola&ok=deleted',
    )
  })

  it('appends an error code', () => {
    expect(flashPath('/admin/role', { error: 'last_admin' })).toBe('/admin/role?error=last_admin')
  })
})

describe('readFlash', () => {
  const okMessages = { blocked: 'Konto zablokowane.' }

  it('shows the page text for a known success key', () => {
    expect(readFlash({ ok: 'blocked' }, okMessages)).toEqual({ kind: 'ok', text: 'Konto zablokowane.' })
  })

  it('prefers an error over a success', () => {
    expect(readFlash({ ok: 'blocked', error: 'forbidden' }, okMessages)?.kind).toBe('error')
  })

  it('shows nothing for keys it does not own, including inherited object names', () => {
    expect(readFlash({ ok: 'hacked' }, okMessages)).toBeNull()
    expect(readFlash({ ok: 'toString' }, okMessages)).toBeNull()
    expect(readFlash({ error: '<b>x</b>' }, okMessages)).toBeNull()
    expect(readFlash({}, okMessages)).toBeNull()
  })

  it('reads the first value when a key is repeated', () => {
    expect(readFlash({ ok: ['blocked', 'x'] }, okMessages)?.text).toBe('Konto zablokowane.')
  })
})
