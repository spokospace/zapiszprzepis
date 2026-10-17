import Image from 'next/image'
import { parseOAuthProviders } from '@/lib/oauth-providers'
import { withFavoriteIntent } from '@/lib/favorites'
import { OAuthButtons } from './oauth-buttons'
import { SignInForm } from './signin-form'

type SearchParams = Promise<{
  error?: string
  email?: string
  sent?: string
  success?: string
  next?: string
  /** A guest's heart: the recipe to favorite once logged in (E01-S06). */
  fav?: string
}>

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

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1>
          <Image
            src="/logo.svg"
            alt="ZapiszPrzepis"
            width={1970}
            height={668}
            priority
            unoptimized
            className="block h-auto w-48"
          />
        </h1>
        <OAuthButtons providers={providers} next={next} />
        <SignInForm error={error} email={email} sent={sent} success={success} next={next} />
      </div>
    </main>
  )
}
