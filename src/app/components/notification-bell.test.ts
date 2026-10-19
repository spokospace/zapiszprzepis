import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

import { NotificationBell } from './notification-bell'

describe('NotificationBell load-error dot', () => {
  it('marks a failed load with an ink dot (3:1 on white), not the 2.1:1 amber', () => {
    const html = renderToStaticMarkup(createElement(NotificationBell, { failedShares: { status: 'error' } }))
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*h-3 w-3[^"]*bg-ink"/)
    expect(html).not.toContain('amber')
  })
})
