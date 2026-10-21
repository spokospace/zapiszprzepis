import Link from 'next/link'
import { Heart } from 'lucide-react'

const FAVORITES_PATH = '/ulubione'

/**
 * The signed-in desktop header's „Ulubione” link (ZMIANY_prototyp §2, row 1): its
 * heart, 17 px bold, no fill or border, underline on hover. Categories moved to the
 * row-2 CategoryBar and „Moje przepisy” to MENU, so this is all that remains here;
 * a guest gets nothing (they sign in from the right cluster, browse from the bar).
 */
export function HeaderNav({ className = '', member = false }: { className?: string; member?: boolean }) {
  if (!member) return null
  return (
    <nav aria-label="Ulubione" className={`items-center ${className}`}>
      <Link
        href={FAVORITES_PATH}
        className="inline-flex min-h-[48px] items-center gap-2 rounded-field px-2 text-[17px] font-bold text-ink no-underline! hover:underline"
      >
        <Heart aria-hidden="true" className="h-[22px] w-[22px] shrink-0 text-action-text" />
        Ulubione
      </Link>
    </nav>
  )
}
