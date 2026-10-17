import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import type { FailedSharesResult } from '@/lib/failed-shares'
import { attentionLabel } from '@/lib/share-error'
import { NOTIFICATIONS_PATH } from '@/lib/routes'

/**
 * Home alert strip under the greeting (E01-S15, handoff §5): "1 przepis
 * wymaga uwagi" + "Zobacz" → /powiadomienia; older users often miss the badge
 * alone. The whole strip is one link (64 px target). It reads the result the
 * home page already loads for the header bell, so it adds no query (#226).
 * Hidden when nothing needs attention, and when the check failed: the bell
 * shows that state, and an absent strip never claims "0".
 */
export function AttentionBanner({ failedShares, className = '' }: { failedShares: FailedSharesResult; className?: string }) {
  if (failedShares.status !== 'ok' || failedShares.shares.length === 0) return null

  return (
    <Link
      href={NOTIFICATIONS_PATH}
      className={`flex min-h-16 items-center gap-3 rounded-field border-2 border-danger bg-danger-bg px-3.5 py-3 no-underline! ${className}`}
    >
      <CircleAlert aria-hidden="true" className="h-7 w-7 shrink-0 text-danger" />
      <span className="flex-1 text-[18px] leading-snug font-bold text-ink">
        {attentionLabel(failedShares.shares.length)}
        <span className="sr-only">.</span>
      </span>
      <span className="text-[17px] font-bold text-ink underline underline-offset-4">Zobacz</span>
    </Link>
  )
}
