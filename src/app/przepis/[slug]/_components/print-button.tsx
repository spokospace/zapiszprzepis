'use client'

import { Printer } from 'lucide-react'

/**
 * "Drukuj" in the recipe actions' second row, beside "Udostępnij" (A9). A quiet text
 * button (handoff 2026-10-28): ink, bold, no frame, 48 px high, a grey wash on hover.
 * Opens the browser's own print dialog; the `@media print` stylesheet (globals.css)
 * strips the app chrome and lays out a clean one-page recipe sheet. No settings sheet —
 * one good universal printout (owner decision 2026-10-25). The button itself is
 * `print:hidden` via the row it sits in.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[48px] items-center gap-2 rounded-pill px-3 text-[17px] font-bold text-ink hover:bg-surface-3"
    >
      <Printer aria-hidden="true" className="h-5 w-5 shrink-0" />
      Drukuj
    </button>
  )
}
