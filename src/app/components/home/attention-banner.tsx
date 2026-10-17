import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import type { FailedSharesResult } from '@/lib/failed-shares'
import { attentionLabel } from '@/lib/share-error'
import { NOTIFICATIONS_PATH } from '@/lib/routes'
import { PageContainer } from '@/app/components/page-container'

/**
 * Home alert strip (E01-S15): "N przepisów wymaga uwagi" + "Zobacz" →
 * /powiadomienia. Reads the failed-shares result the home page already loads
 * for the header bell, so it adds no query (#226). Hidden when nothing needs
 * attention, and also when the check failed: the bell shows that state, and
 * an absent strip never claims "0".
 */
export function AttentionBanner({ failedShares }: { failedShares: FailedSharesResult }) {
  if (failedShares.status !== 'ok' || failedShares.shares.length === 0) return null

  return (
    <PageContainer className="pt-4">
      <section
        aria-label="Powiadomienia"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card border-2 border-danger bg-danger-bg px-4 py-2 text-[19px] font-semibold text-danger"
      >
        <p className="flex items-center gap-2 py-2">
          <TriangleAlert aria-hidden="true" className="h-6 w-6 shrink-0" />
          {attentionLabel(failedShares.shares.length)}
        </p>
        <Link href={NOTIFICATIONS_PATH} className="inline-flex min-h-[48px] items-center text-danger!">
          Zobacz
        </Link>
      </section>
    </PageContainer>
  )
}
