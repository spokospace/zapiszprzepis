'use client'

import { Printer } from 'lucide-react'
import { ACTION_CARD, ACTION_CARD_ICON_COMPACT, ActionLabel } from '@/app/components/ui/action-card'

/**
 * "Wydrukuj przepis" in the recipe actions row, beside "Udostępnij przepis" (A9). Opens the browser's
 * own print dialog; the `@media print` stylesheet (globals.css) strips the app chrome
 * and lays out a clean one-page recipe sheet. No settings sheet — one good universal
 * printout (owner decision 2026-10-25). The button itself is `print:hidden` via the
 * row it sits in.
 */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={ACTION_CARD.compact}>
      <Printer aria-hidden="true" className={ACTION_CARD_ICON_COMPACT} />
      <ActionLabel label="Wydrukuj przepis" short="Drukuj" />
    </button>
  )
}
