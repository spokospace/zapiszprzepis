/**
 * The home greeting's name, kept in this browser so the hero shows it on the first paint
 * instead of waiting for the database (#737). The shared home page is rendered without
 * knowing who reads it; a reader with a session cookie gets the name from here before
 * hydration (`GREETING_SCRIPT`) and the real value from Supabase a moment later.
 *
 * `name` is the greeting's vocative („Mateuszu”), or '' when the reader has none: both are
 * answers, only a missing entry means "not known yet". Never sent to the server.
 */
const KEY = 'zp-greeting'

export type GreetingCache = { userId: string; name: string }

export function readGreetingCache(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): GreetingCache | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(KEY) ?? 'null')
    if (!value || typeof value !== 'object') return null
    const { userId, name } = value as Record<string, unknown>
    return typeof userId === 'string' && typeof name === 'string' ? { userId, name } : null
  } catch {
    return null
  }
}

export function writeGreetingCache(userId: string, name: string | null, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()) {
  try {
    storage?.setItem(KEY, JSON.stringify({ userId, name: name ?? '' } satisfies GreetingCache))
  } catch {
    // Storage full or blocked: the greeting just waits for the database.
  }
}

/** On sign-out and after the name is edited, so no one sees another account's (or an old) name. */
export function clearGreetingCache(storage: Pick<Storage, 'removeItem'> | undefined = safeStorage()) {
  try {
    storage?.removeItem(KEY)
  } catch {
    // Same as above.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/**
 * Runs before the first paint, after `AUTH_COOKIE_SCRIPT`. For a reader with a session
 * cookie and a cached answer it marks <html data-greet> (the heading may show) and, when
 * there is a name, hands it to CSS as `--zp-greeting` (`.greet-name:empty::after`). The
 * name is checked against the same letters-only rule the vocative has, because it ends up
 * in a CSS string.
 */
export const GREETING_SCRIPT = `try{var d=document.documentElement;if(d.dataset.session){var g=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||'null');if(g&&typeof g.name==='string'&&/^[\\p{L}'-]{0,40}$/u.test(g.name)){d.dataset.greet='1';if(g.name)d.style.setProperty('--zp-greeting',JSON.stringify(', '+g.name))}}}catch(e){}`
