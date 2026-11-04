import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { track } from './track'

type Nav = { sendBeacon?: unknown; doNotTrack?: string | null; webdriver?: boolean; globalPrivacyControl?: boolean }

function setup(nav: Nav = {}) {
  const sendBeacon = vi.fn(() => true)
  const fetchMock = vi.fn(() => Promise.resolve(new Response()))
  vi.stubGlobal('navigator', { sendBeacon, doNotTrack: null, webdriver: false, ...nav })
  vi.stubGlobal('fetch', fetchMock)
  return { sendBeacon, fetchMock }
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_USAGE_ANALYTICS', '1')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('track()', () => {
  it.each([
    ['the flag is off', '0', {}],
    ['the flag is unset', '', {}],
    ['Global Privacy Control is on', '1', { globalPrivacyControl: true }],
    ['Do Not Track is 1', '1', { doNotTrack: '1' }],
    ['the browser is automated', '1', { webdriver: true }],
  ])('does nothing when %s', (_name, flag, nav) => {
    const { sendBeacon, fetchMock } = setup(nav)
    vi.stubEnv('NEXT_PUBLIC_USAGE_ANALYTICS', flag)
    track('recipe_view', 'zupa')
    expect(sendBeacon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does nothing without a navigator (server render)', () => {
    vi.stubGlobal('navigator', undefined)
    expect(() => track('recipe_view', 'zupa')).not.toThrow()
  })

  it('beacons exactly {e, s} as text/plain to /api/e', async () => {
    const { sendBeacon, fetchMock } = setup()
    track('category_view', 'zupy')
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob]
    expect(url).toBe('/api/e')
    expect(blob.type).toBe('text/plain')
    expect(JSON.parse(await blob.text())).toEqual({ e: 'category_view', s: 'zupy' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to a credential-less keepalive fetch without sendBeacon', () => {
    const { fetchMock } = setup({ sendBeacon: undefined })
    track('timer_start', 'zupa')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/e')
    expect(init).toEqual({
      method: 'POST',
      body: JSON.stringify({ e: 'timer_start', s: 'zupa' }),
      keepalive: true,
      credentials: 'omit',
    })
  })

  it('falls back to fetch when the browser refuses the beacon', () => {
    const { sendBeacon, fetchMock } = setup()
    sendBeacon.mockReturnValue(false)
    track('print', 'zupa')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never throws, even if the transport does', () => {
    const { sendBeacon } = setup()
    sendBeacon.mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => track('print', 'zupa')).not.toThrow()
  })

  it('does not touch cookies or web storage', () => {
    setup()
    const touched = vi.fn()
    const storage = { getItem: touched, setItem: touched }
    vi.stubGlobal('document', {
      get cookie() {
        touched()
        return ''
      },
      set cookie(_value: string) {
        touched()
      },
    })
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
    track('recipe_view', 'zupa')
    expect(touched).not.toHaveBeenCalled()
  })
})
