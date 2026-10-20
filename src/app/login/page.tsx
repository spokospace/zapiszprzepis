import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/app/components/brand-logo'
import { parseOAuthProviders } from '@/lib/oauth-providers'
import { withFavoriteIntent } from '@/lib/favorites'
import { PRIVACY_POLICY_PATH, TERMS_PATH } from '@/lib/routes'
import { OAuthButtons } from './oauth-buttons'
import { SignInForm } from './signin-form'

export const metadata: Metadata = { title: 'Zaloguj się · Zapisz Przepis' }

type SearchParams = Promise<{
  error?: string
  email?: string
  sent?: string
  success?: string
  next?: string
  /** A guest's heart: the recipe to favorite once logged in (E01-S06). */
  fav?: string
}>

/**
 * Screen 3a (E01-S12b): Facebook/Google first, then email + password, which the
 * owner keeps for existing and QA accounts.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { error, email, sent, success, next: rawNext, fav } = await searchParams
  // The intent rides inside `next`, which every login path already carries to
  // postLoginPath; that is where the favorite is saved.
  const next = withFavoriteIntent(rawNext, fav)
  // E01-S12: off unless the owner lists providers (see oauth-providers.ts).
  const providers = parseOAuthProviders(process.env.AUTH_OAUTH_PROVIDERS)
  const hasOAuth = providers.length > 0

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
          <h1 className="text-[30px] leading-tight font-bold text-ink">Zaloguj się</h1>
          {hasOAuth && (
            <>
              <p className="text-[18px] leading-normal text-ink-soft">Bez nowego hasła. Użyj konta, które już masz.</p>
              <OAuthButtons providers={providers} next={next} />
              <p className="flex items-center gap-3 text-[16px] text-ink-soft before:h-0.5 before:flex-1 before:bg-border-card after:h-0.5 after:flex-1 after:bg-border-card">
                albo emailem
              </p>
            </>
          )}
          <SignInForm error={error} email={email} sent={sent} success={success} next={next} />
          <p className="mt-auto pt-4 text-[16px] leading-normal text-ink-soft">
            Logując się, akceptujesz <Link href={TERMS_PATH} className="font-bold text-action-text hover:text-action-hover">regulamin</Link> i{' '}
            <Link href={PRIVACY_POLICY_PATH} className="font-bold text-action-text hover:text-action-hover">
              politykę prywatności
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
