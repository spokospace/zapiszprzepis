import { beforeEach, describe, expect, it, vi } from 'vitest'

const track = vi.hoisted(() => vi.fn())
vi.mock('@/lib/analytics/track', () => ({ track }))

import { PrintButton } from './print-button'

describe('PrintButton usage count', () => {
  beforeEach(() => track.mockClear())

  it('counts one print per click, then opens the print dialog', () => {
    const print = vi.fn()
    vi.stubGlobal('window', { print })
    const button = PrintButton({ recipeSlug: 'zupa-krem' }) as unknown as { props: { onClick: () => void } }
    button.props.onClick()
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('print', 'zupa-krem')
    expect(print).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
