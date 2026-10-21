import Link from 'next/link'
import { LogoWordmark } from './brand-logo'
import { PageContainer } from './page-container'
import { TERMS_PATH, PRIVACY_POLICY_PATH, DATA_DELETION_PATH } from '@/lib/routes'

const LINKS = [
  { href: TERMS_PATH, label: 'Regulamin' },
  { href: PRIVACY_POLICY_PATH, label: 'Polityka prywatności' },
  { href: DATA_DELETION_PATH, label: 'Usuwanie danych' },
]

/**
 * The desktop footer (ZMIANY_prototyp §8): the wordmark and a copyright line on the
 * left, the three legal links on the right. Desktop only — a phone has none (the
 * legal pages are reachable from the auth screens and MENU is the primary chrome).
 * `mt-auto` keeps it at the bottom when a page is short.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto hidden border-t-2 border-border-card bg-surface-2 lg:block">
      <PageContainer className="flex items-center justify-between gap-6 py-5">
        <div className="flex flex-col gap-0.5">
          <LogoWordmark className="text-[19px]" />
          <span className="text-[16px] text-ink-soft">© 2026 zapiszprzepis.pl</span>
        </div>
        <nav aria-label="Stopka" className="flex items-center gap-4">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-12 items-center text-[17px] font-semibold text-ink underline underline-offset-4 hover:text-action-hover"
            >
              {label}
            </Link>
          ))}
        </nav>
      </PageContainer>
    </footer>
  )
}
