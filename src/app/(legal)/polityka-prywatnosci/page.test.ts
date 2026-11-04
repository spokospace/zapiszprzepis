import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PrivacyPolicyPage from './page'
import TermsPage from '../regulamin/page'

// #376: the policy and the public pages must say the same thing about gender.
describe('privacy policy — gender (#376)', () => {
  const html = renderToStaticMarkup(PrivacyPolicyPage())

  it('promises others never see the gender, and public wording stays neutral', () => {
    expect(html).toContain('ani płci')
    expect(html).toContain('zawsze piszemy neutralnie („Dodane przez …”)')
  })

  it('says gender is optional, not a mandatory first-login step', () => {
    expect(html).toContain('Płci nie musisz podawać')
    expect(html).not.toContain('przy pierwszym logowaniu')
  })

  it('shows the effective date of this version', () => {
    expect(html).toContain('Obowiązuje od: 2 listopada 2026')
  })
})

// The anonymous usage counters (/api/e) and the Search Console sync are disclosed,
// and the old "no tools that track traffic" promise is gone.
describe('privacy policy — statistics', () => {
  const html = renderToStaticMarkup(PrivacyPolicyPage())

  it('describes the anonymous counters: daily totals, no cookies, no stored IP', () => {
    expect(html).toContain('Anonimowe statystyki')
    expect(html).toContain('Zapisujemy tylko dzienne sumy')
    expect(html).toContain('nie jest nigdzie zapisywany')
  })

  it('mentions Search Console and no longer claims no traffic tools at all', () => {
    expect(html).toContain('Google Search Console')
    expect(html).not.toContain('narzędzi, które śledzą ruch na stronie')
  })
})

describe('terms — gender (#376)', () => {
  it('say gender is optional', () => {
    const html = renderToStaticMarkup(TermsPage())
    expect(html).toContain('Płci nie musisz podawać')
    expect(html).not.toContain('przy pierwszym logowaniu')
  })
})
