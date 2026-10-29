'use client'

import { useEffect, useState } from 'react'
import { Share2 } from 'lucide-react'

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

type ShareNavigator = Partial<Pick<Navigator, 'share'>> & { clipboard?: Partial<Pick<Clipboard, 'writeText'>> }

/**
 * Shares the recipe link: the system share sheet where the browser has one,
 * else a copy to the clipboard. Closing the share sheet is a choice, not an
 * error (`cancelled`); a refused share sheet still tries the clipboard.
 */
export async function shareLink(nav: ShareNavigator, data: { title: string; url: string }): Promise<ShareOutcome> {
  if (typeof nav.share === 'function') {
    try {
      await nav.share(data)
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
    }
  }
  if (typeof nav.clipboard?.writeText !== 'function') return 'failed'
  try {
    await nav.clipboard.writeText(data.url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** How long "Skopiowano link…" stays (like the favourite toast); a failure stays until the next try. */
export const COPIED_MESSAGE_MS = 5000

export const SHARE_MESSAGES: Partial<Record<ShareOutcome, string>> = {
  copied: 'Skopiowano link do przepisu.',
  failed: 'Nie udało się udostępnić. Skopiuj adres z paska przeglądarki.',
}

/**
 * "Udostępnij przepis" in the recipe action row, beside "Wydrukuj przepis". The outcome is spoken from a status region that is always mounted.
 */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null)
  const message = outcome ? SHARE_MESSAGES[outcome] : undefined

  useEffect(() => {
    if (outcome !== 'copied') return
    const timer = setTimeout(() => setOutcome(null), COPIED_MESSAGE_MS)
    return () => clearTimeout(timer)
  }, [outcome])

  return (
    <span className="flex flex-col gap-2">
      <button
        type="button"
        onClick={async () => {
          setOutcome(null)
          setOutcome(await shareLink(navigator, { title, url }))
        }}
        className="inline-flex min-h-[48px] items-center gap-2 rounded-pill px-3 text-[17px] font-bold text-ink [overflow-wrap:anywhere] hover:bg-surface-3"
      >
        <Share2 aria-hidden="true" className="h-5 w-5 shrink-0" />
        Udostępnij
      </button>
      <span
        role="status"
        className={`max-w-[260px] text-[16px] empty:hidden ${outcome === 'failed' ? 'font-bold text-danger' : 'text-ink-soft'}`}
      >
        {message}
      </span>
    </span>
  )
}
