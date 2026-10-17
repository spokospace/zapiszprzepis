/**
 * The first http(s) URL in any of the candidate strings, trimmed of trailing
 * punctuation the sharing app may have appended. Apps often hand over "text +
 * link" ("Zobacz to https://…"), both to the Web Share Target and on the
 * clipboard, so /share and the „Wklej” button on /dodaj (E01-S10) share this.
 */
export function extractFirstUrl(...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    const match = candidate?.match(/https?:\/\/[^\s<>"']+/i)
    if (match) return match[0].replace(/[)\].,;!?]+$/, '')
  }
  return null
}
