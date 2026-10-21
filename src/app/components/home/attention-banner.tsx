import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import type { FailedSharesResult } from '@/lib/failed-shares'
import { attentionLabel } from '@/lib/share-error'
import { NOTIFICATIONS_PATH } from '@/lib/routes'

/**
 * Home alert strip under the greeting (E01-S15, E01-S31 §5): "1 przepis
 * wymaga uwagi" + "Popraw" → /powiadomienia; older users often miss the badge
 * alone. The whole strip is one link (64 px target), a 2 px #9a3412 frame on
 * white (no longer the red tint). It reads the result the home page already loads
 * for the header bell, so it adds no query (#226). Hidden when nothing needs
 * attention, and when the check failed: the bell shows that state, and an absent
 * strip never claims "0".
 */
// TODO(#404): confirm "wymaga uwagi" wording — the handoff's explanatory text is a placeholder.
export function AttentionBanner({ failedShares, className = '' }: { failedShares: FailedSharesResult; className?: string }) {
  if (failedShares.status !== 'ok' || failedShares.shares.length === 0) return null

  return (
    <Link
      href={NOTIFICATIONS_PATH}
      className={`flex min-h-16 items-center gap-3 rounded-tile border-2 border-action-text bg-white px-3.5 py-3 no-underline! ${className}`}
    >
      <CircleAlert aria-hidden="true" className="h-7 w-7 shrink-0 text-action-text" />
      <span className="flex-1 text-[17px] leading-snug font-bold text-ink">
        {attentionLabel(failedShares.shares.length)}
        <span className="sr-only">.</span>
        {/* On a phone the whole frame is the link, and says so. */}
        <span className="mt-0.5 block text-[16px] font-normal text-ink-soft sm:hidden">Dotknij, żeby spróbować ponownie</span>
      </span>
      <span className="hidden text-[17px] font-bold text-action-text underline underline-offset-4 sm:inline">Popraw</span>
    </Link>
  )
}
