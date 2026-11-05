/** Supabase's session cookie, also when chunked or while an OAuth sign-in is in progress. */
const AUTH_COOKIE = /(?:^|;\s*)sb-[^=;\s]*-auth-token/

/** Whether a `Cookie` header or `document.cookie` holds a session. */
export function hasAuthCookie(cookies: string): boolean {
  return AUTH_COOKIE.test(cookies)
}

/** Runs before the first paint, so `.session-pending` can hide the guest's view from a reader with a session. */
export const AUTH_COOKIE_SCRIPT = `if(${AUTH_COOKIE}.test(document.cookie))document.documentElement.dataset.session='1'`
