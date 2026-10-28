import { staffErrorMessage, type StaffErrorCode } from './errors'

/**
 * The result of a panel action travels in the URL (`?ok=blocked`, `?error=forbidden`)
 * across the redirect after a form post, so it works without client JavaScript and
 * survives a reload. Only keys are carried; the text is looked up on arrival, so
 * a crafted link can show nothing but our own messages.
 */
export type Flash = { kind: 'ok' | 'error'; text: string }

type Outcome = { ok: string } | { error: StaffErrorCode }

/** `path` with the outcome appended, keeping any query string already on it. */
export function flashPath(path: string, outcome: Outcome): string {
  const [base, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  params.delete('ok')
  params.delete('error')
  if ('ok' in outcome) params.set('ok', outcome.ok)
  else params.set('error', outcome.error)
  return `${base}?${params.toString()}`
}

type FlashParams = { ok?: string | string[]; error?: string | string[] }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/** The banner for a page's search params; `okMessages` is that page's own table of success texts. */
export function readFlash(params: FlashParams, okMessages: Readonly<Record<string, string>>): Flash | null {
  const error = staffErrorMessage(first(params.error))
  if (error) return { kind: 'error', text: error }
  const ok = first(params.ok)
  if (ok && Object.hasOwn(okMessages, ok)) return { kind: 'ok', text: okMessages[ok] }
  return null
}
