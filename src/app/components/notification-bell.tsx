'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Bell, X } from 'lucide-react'
import { retryShare } from '@/app/(authenticated)/recipes/retry-action'
import { dismissShare, dismissAllFailedShares } from '@/app/(authenticated)/recipes/dismiss-action'
import type { FailedSharesResult } from '@/lib/failed-shares'

/**
 * Header notification bell — the home for failed extractions (S-06). Replaces
 * the persistent inline red banner. Actions are called directly inside a
 * `useTransition` (not via `<form action={serverAction}>`), which sidesteps the
 * `action="javascript:throw…"` progressive-enhancement placeholder that broke
 * the old "Ponów" button.
 *
 * When the failed shares could not be loaded, the bell says so instead of
 * claiming there is nothing to show.
 */
export function NotificationBell({ failedShares: result }: { failedShares: FailedSharesResult }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const loadFailed = result.status === 'error'
  const failedShares = result.status === 'ok' ? result.shares : []
  const count = failedShares.length

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={
          loadFailed
            ? 'Powiadomienia (nie udało się sprawdzić)'
            : count > 0
              ? `Powiadomienia (${count})`
              : 'Powiadomienia'
        }
        aria-expanded={open}
        aria-controls={open ? 'notifications-panel' : undefined}
        aria-haspopup="menu"
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {count}
          </span>
        )}
        {loadFailed && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          id="notifications-panel"
          role="menu"
          aria-label="Powiadomienia"
          className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Powiadomienia</span>
            {count > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => dismissAllFailedShares())}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                Wyczyść wszystkie
              </button>
            )}
          </div>

          {loadFailed ? (
            <p className="px-4 py-6 text-center text-sm text-amber-700">
              Nie udało się sprawdzić powiadomień. Odśwież stronę.
            </p>
          ) : count === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Wszystko gotowe — nic nie wymaga uwagi.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
              {failedShares.map((share) => (
                <li key={share.id} className="px-4 py-3">
                  <p className="mb-0.5 text-sm font-medium text-gray-900">
                    Nie udało się zapisać przepisu
                  </p>
                  {share.shared_url.startsWith('http') ? (
                    <a
                      href={share.shared_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-xs text-gray-500 hover:underline"
                    >
                      {share.shared_url}
                    </a>
                  ) : (
                    // Only http(s) URLs are linkable — a non-http scheme
                    // (javascript:, data:) is shown as inert text.
                    <p className="block truncate text-xs text-gray-500">{share.shared_url}</p>
                  )}
                  {share.error_message && (
                    <p className="mt-0.5 truncate text-xs text-gray-400">{share.error_message}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => startTransition(() => retryShare(share.id))}
                      className="rounded-md bg-orange-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      Ponów
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => startTransition(() => dismissShare(share.id))}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X aria-hidden="true" className="h-3 w-3" />
                      Odrzuć
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
