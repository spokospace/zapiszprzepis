import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SignUpForm } from './signup-form'
import { LegalLinks } from '@/app/components/legal-page'
import { BrandLogo } from '@/app/components/brand-logo'

export const metadata: Metadata = { title: 'Załóż konto · ZapiszPrzepis' }

type SearchParams = Promise<{
  error?: string
  email?: string
  sent?: string
}>

/** Email sign-up with an invite code, laid out like screen 3a (header "← Wróć", logo, H1). */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { error, email, sent } = await searchParams

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b-2 border-border-card px-2 py-1">
        <Link
          href="/"
          className="inline-flex min-h-[56px] items-center gap-1.5 px-2 text-[18px] font-bold text-ink no-underline!"
        >
          <ArrowLeft aria-hidden="true" className="h-6 w-6" />
          Wróć
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center px-5 py-8">
        <div className="flex w-full max-w-sm flex-1 flex-col gap-5">
          <BrandLogo />
          <h1 className="text-[30px] leading-tight font-bold text-ink">Załóż konto</h1>
          <p className="text-[18px] leading-normal text-ink-soft">
            Wpisz swój email i kod zaproszenia. Wyślemy link, który dokończy rejestrację.
          </p>
          <SignUpForm error={error} email={email} sent={sent} />
          <LegalLinks className="mt-auto pt-4" />
        </div>
      </main>
    </div>
  )
}
