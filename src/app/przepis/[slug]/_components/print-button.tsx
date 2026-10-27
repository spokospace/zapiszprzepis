'use client'

import { Printer } from 'lucide-react'
import { buttonClasses } from '@/app/components/ui/button'

/**
 * "Drukuj" in the recipe actions row, beside "Udostępnij" (A9). Opens the browser's
 * own print dialog; the `@media print` stylesheet (globals.css) strips the app chrome
 * and lays out a clean one-page recipe sheet. No settings sheet — one good universal
 * printout (owner decision 2026-10-25). The button itself is `print:hidden` via the
 * row it sits in.
 */
export function PrintButton({ className = buttonClasses('outline', 'md') }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer aria-hidden="true" size={22} className="shrink-0" />
      Drukuj
    </button>
  )
}
