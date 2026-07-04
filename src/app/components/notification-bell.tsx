'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Bell, X } from 'lucide-react'
import { retryShare } from '@/app/(authenticated)/recipes/retry-action'
import { dismissShare, dismissAllFailedShares } from '@/app/(authenticated)/recipes/dismiss-action'
import type { FailedShare } from '@/lib/failed-shares'

/**
 * Header notification bell — the home for failed extractions (S-06). Replaces
 * the persistent inline red banner. Actions are called directly inside a
 * `useTransition` (not via `<form action={serverAction}>`), which sidesteps the
 * `action="javascript:throw…"` progressive-enhancement placeholder that broke
 * the old "Ponów" button.
 */
export function NotificationBell({ failedShares }: { failedShares: FailedShare[] }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const count = failedShares.length

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={count > 0 ? `Powiadomienia (${count})` : 'Powiadomienia'}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
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

          {count === 0 ? (
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
                  <a
                    href={share.shared_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-gray-500 hover:underline"
                  >
                    {share.shared_url}
                  </a>
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
