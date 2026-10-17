// OAuth sign-in providers (E01-S12). Pure, so the login page, the server action
// and tests share one parser.
//
// OAuth sign-up creates accounts without an invite code, so the buttons stay
// off until the owner lists providers in AUTH_OAUTH_PROVIDERS (server env) —
// after E01-S11's "full access" gate on adding recipes is live in production.

// Facebook first: screen 3a lists it above Google (E01-S12b).
export const OAUTH_PROVIDERS = ['facebook', 'google'] as const
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]

/**
 * The enabled providers from a comma-separated env value ("google,facebook"):
 * trimmed, lower-cased, deduplicated, unknown names dropped, in canonical order.
 */
export function parseOAuthProviders(raw: string | null | undefined): OAuthProvider[] {
  if (!raw) return []
  const listed = new Set(raw.split(',').map((p) => p.trim().toLowerCase()))
  return OAUTH_PROVIDERS.filter((p) => listed.has(p))
}

/** Narrow an untrusted form value to an enabled provider; null otherwise. */
export function enabledProvider(raw: unknown, enabled: readonly OAuthProvider[]): OAuthProvider | null {
  return typeof raw === 'string' && (enabled as readonly string[]).includes(raw) ? (raw as OAuthProvider) : null
}

/** Visible button label — the provider name in the Polish instrumental case. */
export const OAUTH_LABELS: Record<OAuthProvider, string> = {
  google: 'Zaloguj przez Google',
  facebook: 'Zaloguj przez Facebooka',
}
