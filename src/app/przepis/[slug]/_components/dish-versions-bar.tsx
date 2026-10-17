import { Layers, ChevronDown } from 'lucide-react'
import { versionsBarLabel } from '@/lib/dish-versions'

/**
 * The bar under the source block (E01-S21): a full-width anchor that scrolls to
 * the versions section. Rendered only when the dish has at least one other
 * recipe. Native anchor, so it works without JS; the section heading takes focus.
 */
export function DishVersionsBar({ count, dishAccusative }: { count: number; dishAccusative: string | null }) {
  if (count < 1) return null
  return (
    <a
      href="#inne-przepisy"
      className="mt-4 flex min-h-[60px] items-center gap-3 rounded-[12px] border-2 border-border-accent bg-surface-accent px-4 py-3 text-ink no-underline! lg:mt-5"
    >
      <Layers aria-hidden="true" size={24} className="shrink-0 text-action-text" />
      <span className="min-w-0 flex-1 text-[18px] font-bold break-words">{versionsBarLabel(count, dishAccusative)}</span>
      <ChevronDown aria-hidden="true" size={24} className="shrink-0 text-ink-soft" />
    </a>
  )
}
