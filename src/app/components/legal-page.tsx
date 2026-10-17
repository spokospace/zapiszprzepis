import type { ReactNode } from 'react'
import Link from 'next/link'
import { DATA_DELETION_PATH, PRIVACY_POLICY_PATH, TERMS_PATH } from '@/lib/routes'
import { PageContainer } from '@/app/components/page-container'

/**
 * Shell of the legal pages (regulamin, polityka prywatności, usuwanie danych):
 * one readable column at the 19px body size, headings with anchors, and the
 * cross-links at the bottom.
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex-1 py-8">
      <PageContainer narrow>
        <article className="mx-auto max-w-3xl text-[19px] leading-relaxed text-ink">
          <h1 className="text-[32px] font-bold leading-tight">{title}</h1>
          <p className="mt-2 text-[16px] text-ink-soft">
            Obowiązuje od: 17 października 2026
          </p>
          <div className="mt-6 flex flex-col gap-4">{children}</div>
          <LegalLinks className="mt-10 border-t border-border-card pt-6" />
        </article>
      </PageContainer>
    </main>
  )
}

/** Inline link inside legal text: the accent link colour (links are underlined globally). */
export const LEGAL_LINK = 'text-action-text hover:text-action-hover'

/** A section heading with a stable anchor (#id) to link to. */
export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="mt-6 text-[24px] font-bold leading-snug">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  )
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-6">{children}</ul>
}

/**
 * Links to the three legal pages, for /signup and the legal pages themselves.
 * /login (3a) has its own one-line footer built from the same path constants.
 */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Informacje prawne" className={className}>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-[16px] text-ink-soft">
        <li>
          <Link href={TERMS_PATH} className="inline-flex min-h-[48px] items-center text-ink-soft">
            Regulamin
          </Link>
        </li>
        <li>
          <Link href={PRIVACY_POLICY_PATH} className="inline-flex min-h-[48px] items-center text-ink-soft">
            Polityka prywatności
          </Link>
        </li>
        <li>
          <Link href={DATA_DELETION_PATH} className="inline-flex min-h-[48px] items-center text-ink-soft">
            Usuwanie danych
          </Link>
        </li>
      </ul>
    </nav>
  )
}
