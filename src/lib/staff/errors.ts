/**
 * Errors the admin SQL functions raise, as stable codes. The functions raise a
 * bare code as the message (`raise exception 'cannot_target_staff'`), PostgREST
 * passes it through, and the panel shows the Polish text below. Free text from
 * the database is never shown to staff, and a code in a URL is only ever looked
 * up in this table, never printed.
 */
export const STAFF_ERRORS = {
  forbidden: 'Brak uprawnień do tej operacji.',
  not_found: 'Nie znaleziono takiego rekordu.',
  cannot_target_self: 'Tej operacji nie wykonasz na własnym koncie.',
  cannot_target_staff: 'To konto ma rolę w panelu. Najpierw odbierz mu rolę.',
  last_admin: 'To ostatni administrator. Najpierw nadaj rolę komuś innemu.',
  cannot_change_own_role: 'Własnej roli nie zmienisz. Poproś innego administratora.',
  unknown_role: 'Nie ma takiej roli.',
  not_retryable: 'Ten import nie wymaga ponowienia albo ktoś już go ponowił.',
  dispatch_failed: 'Nie udało się uruchomić przetwarzania. Import wrócił na listę błędów.',
  invalid_input: 'Dane są niepoprawne.',
  confirm_mismatch: 'Potwierdzenie się nie zgadza. Nic nie zmieniono.',
  unknown: 'Nie udało się. Spróbuj ponownie.',
} as const

export type StaffErrorCode = keyof typeof STAFF_ERRORS

const CODES = new Set<string>(Object.keys(STAFF_ERRORS))

/** The code behind a Supabase error: the message when it is one of ours, else `unknown`. */
export function staffErrorCode(error: { message?: string } | null | undefined): StaffErrorCode {
  const message = error?.message?.trim()
  return message && CODES.has(message) ? (message as StaffErrorCode) : 'unknown'
}

/** The Polish text for a code received from a URL or a result; null for anything that is not ours. */
export function staffErrorMessage(code: string | null | undefined): string | null {
  return code && CODES.has(code) ? STAFF_ERRORS[code as StaffErrorCode] : null
}
