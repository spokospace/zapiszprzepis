'use client'

import { useFormStatus } from 'react-dom'
import { buttonClasses } from '@/app/components/ui/button'
import { OAUTH_LABELS, type OAuthProvider } from '@/lib/oauth-providers'
import { signInWithOAuthProvider } from './actions'

// Brand marks are decorative — the visible text label names the provider. On the
// blue Facebook button the mark is white, per Meta's brand rules.
function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  if (provider === 'google') {
    return (
      <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
        <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24">
      <path
        className="fill-white"
        d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"
      />
    </svg>
  )
}

function ProviderButton({ provider }: { provider: OAuthProvider }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${buttonClasses(provider === 'facebook' ? 'facebook' : 'outline', 'lg')} min-h-[60px] w-full gap-3 text-[19px]`}>
      <ProviderIcon provider={provider} />
      {pending ? 'Przekierowuję…' : OAUTH_LABELS[provider]}
    </button>
  )
}

interface OAuthButtonsProps {
  providers: readonly OAuthProvider[]
  next?: string
}

/** "Zaloguj przez Facebooka / Google" (E01-S12, 3a in E01-S12b); renders nothing when OAuth is off. */
export function OAuthButtons({ providers, next }: OAuthButtonsProps) {
  if (providers.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      {providers.map((provider) => (
        <form key={provider} action={signInWithOAuthProvider}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="next" value={next ?? ''} />
          <ProviderButton provider={provider} />
        </form>
      ))}
    </div>
  )
}
