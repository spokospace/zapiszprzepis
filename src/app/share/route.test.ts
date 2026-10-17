import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./actions', () => ({ triggerRecipeExtraction: vi.fn() }))
vi.mock('server-only', () => ({}))

import { NextRequest } from 'next/server'
import { triggerRecipeExtraction } from './actions'
import { NO_FULL_ACCESS } from '@/lib/full-access'
import { POST } from './route'

function share(url: string) {
  const body = new FormData()
  body.set('url', url)
  return new NextRequest('https://zapiszprzepis.pl/share', { method: 'POST', body })
}

describe('POST /share — Web Share Target errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('sends a user without full access to the code gate (E01-S11)', async () => {
    vi.mocked(triggerRecipeExtraction).mockRejectedValue(new Error(NO_FULL_ACCESS))

    const res = await POST(share('https://example.com/tiramisu'))

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://zapiszprzepis.pl/?add_error=no_access')
  })

  it('still sends a guest to login', async () => {
    vi.mocked(triggerRecipeExtraction).mockRejectedValue(new Error('Not authenticated'))

    const res = await POST(share('https://example.com/tiramisu'))

    expect(res.headers.get('location')).toBe('https://zapiszprzepis.pl/login')
  })
})
