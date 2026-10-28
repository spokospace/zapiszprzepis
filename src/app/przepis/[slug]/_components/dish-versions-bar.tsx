import { ChevronDown } from 'lucide-react'
import { versionsBarLabel } from '@/lib/dish-versions'

/**
 * The link under the header (E01-S21; handoff 2026-10-28): a plain underlined anchor
 * "Inne przepisy na {danie} (N)" that scrolls to the versions section — no box.
 * Rendered only when the dish has at least one other recipe. Native anchor, so it
 * works without JS; the section heading takes focus.
 */
export function DishVersionsBar({ count, dishAccusative }: { count: number; dishAccusative: string | null }) {
  if (count < 1) return null
  return (
    <a
      href="#inne-przepisy"
      className="mt-4 inline-flex min-h-[48px] items-center gap-1.5 text-[17px] font-bold text-action-text underline hover:text-action-hover lg:mt-5"
    >
      {versionsBarLabel(count, dishAccusative)}
      <ChevronDown aria-hidden="true" size={20} className="shrink-0" />
    </a>
  )
}
