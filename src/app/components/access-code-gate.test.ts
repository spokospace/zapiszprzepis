import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The add form reads the router's search params; this suite only checks that
// the gate hands over to it, so a marker stands in for it.
vi.mock('@/app/components/add-recipe-form', () => ({
  AddRecipeForm: ({ autoFocus }: { autoFocus?: boolean }) =>
    createElement('div', { 'data-testid': 'add-form', 'data-autofocus': String(autoFocus) }),
}))
vi.mock('@/app/(actions)/redeem-access-code', () => ({ redeemAccessCode: vi.fn() }))

import { AccessCodeGateView } from './access-code-gate'
import type { RedeemState } from '@/app/(actions)/redeem-access-code'

function render(status: RedeemState['status'], extra: { notice?: boolean; pending?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(AccessCodeGateView, {
      state: { status },
      pending: extra.pending ?? false,
      formAction: vi.fn(),
      code: 'ABCD1234',
      onCodeChange: vi.fn(),
      notice: extra.notice,
    }),
  )
}

describe('AccessCodeGateView — screen 3c (E01-S11)', () => {
  it('asks for the code with a labelled field and the "Odblokuj" button', () => {
    const html = render('idle')
    expect(html).toContain('<label for="access-code"')
    expect(html).toContain('id="access-code"')
    expect(html).toContain('Odblokuj')
    expect(html).toContain('border-field')
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('aria-invalid')
    expect(html).not.toContain('data-testid="add-form"')
  })

  it('shows a wrong code as role=alert, with the danger border and aria-invalid', () => {
    const html = render('invalid')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Ten kod nie działa')
    expect(html).toContain('border-danger')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="access-code-error"')
    // The typed code survives the rejection.
    expect(html).toContain('value="ABCD1234"')
  })

  it('shows the rate limit as an alert without marking the field invalid', () => {
    const html = render('rate_limited')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Za dużo prób')
    expect(html).not.toContain('aria-invalid')
  })

  it('on success announces role=status with ✓ and shows the link form right away', () => {
    const html = render('ok')
    expect(html).toContain('role="status"')
    expect(html).toContain('Gotowe — możesz dodawać przepisy.')
    expect(html).toContain('data-testid="add-form"')
    expect(html).toContain('data-autofocus="true"')
    expect(html).not.toContain('id="access-code"')
  })

  it('explains why when the user arrived from a blocked add', () => {
    expect(render('idle', { notice: true })).toContain('Dodawanie przepisów wymaga kodu dostępu.')
    expect(render('idle')).not.toContain('Dodawanie przepisów wymaga kodu dostępu.')
  })

  it('disables the button while checking', () => {
    const html = render('idle', { pending: true })
    expect(html).toContain('Sprawdzam…')
    expect(html).toMatch(/<button[^>]*disabled/)
  })
})

describe('AccessCodeGateView — repeated wrong codes (E01-S11)', () => {
  it('drops the alert while checking, so the next rejection is announced again', () => {
    const html = renderToStaticMarkup(
      createElement(AccessCodeGateView, {
        state: { status: 'invalid' },
        pending: true,
        formAction: vi.fn(),
        code: 'ABCD1234',
        onCodeChange: vi.fn(),
      }),
    )
    expect(html).not.toContain('role="alert"')
  })
})
