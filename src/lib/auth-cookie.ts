/** Supabase's session cookie, also when chunked or while an OAuth sign-in is in progress. */
const AUTH_COOKIE = /(?:^|;\s*)sb-[^=;\s]*-auth-token/

/** Whether a `Cookie` header or `document.cookie` holds a session. */
export function hasAuthCookie(cookies: string): boolean {
  return AUTH_COOKIE.test(cookies)
}
