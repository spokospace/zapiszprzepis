import { BrandLogo } from '@/app/components/brand-logo'
import { redirect } from 'next/navigation'
import { parseEmailOtpType } from '@/lib/safe-redirect'
import { confirmEmailLink } from './actions'

type SearchParams = Promise<Record<string, string | undefined>>

// Email links land here with a token_hash (see the Supabase email templates).
// The token is spent only when the user presses the button: email security
// scanners that open every link with a GET would otherwise burn it before the
// user ever clicks.
export default async function ConfirmEmailLinkPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const { token_hash: tokenHash, type: rawType, next } = params
  const type = parseEmailOtpType(rawType)

  // A link from the old {{ .ConfirmationURL }} template went through Supabase's
  // verify endpoint and arrives with a PKCE `code` (or its error) instead of a
  // token_hash. Hand it to the callback, which still handles that flow.
  if (!tokenHash && (params.code || params.error)) {
    const query = new URLSearchParams(
      Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string'),
    )
    redirect(`/auth/callback?${query}`)
  }

  if (!tokenHash || !type) {
    redirect('/login?error=invalid')
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col gap-6">
        <h1>
          <BrandLogo />
        </h1>
        <div className="w-60 max-w-full">
          <h2 className="mt-4 text-sm text-zinc-600">{type === 'recovery' ? 'Ustaw nowe hasło' : 'Zaloguj się'}</h2>
          <form action={confirmEmailLink} className="mt-6 flex flex-col gap-3">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className="mt-2 rounded-md bg-zinc-900 px-4 py-2.5 text-base font-medium text-white hover:bg-zinc-800"
            >
              Kontynuuj
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
