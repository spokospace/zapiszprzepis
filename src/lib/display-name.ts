/** Max stored length for a display name ("nazwa wyświetlana"). */
export const DISPLAY_NAME_MAX = 60
/** Min length so a name is actually a name, not a stray character. */
export const DISPLAY_NAME_MIN = 2

export type DisplayNameResult =
  | { ok: true; value: string }
  | { ok: false; error: string }

/**
 * Validate and normalize a display name from user input. Trims surrounding
 * whitespace and collapses internal runs to single spaces; rejects empty,
 * too-short, and too-long values. Pure — shared by the server action and tests.
 */
export function validateDisplayName(raw: unknown): DisplayNameResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Podaj nazwę wyświetlaną.' }
  }
  const value = raw.trim().replace(/\s+/g, ' ')
  if (value.length < DISPLAY_NAME_MIN) {
    return { ok: false, error: 'Nazwa jest za krótka.' }
  }
  if (value.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `Nazwa może mieć najwyżej ${DISPLAY_NAME_MAX} znaków.` }
  }
  return { ok: true, value }
}
