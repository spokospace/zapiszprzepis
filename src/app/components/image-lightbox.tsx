'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'

export interface LightboxItem {
  src: string
  /** Shown top-left over the photo, e.g. „3 / 8" (gallery) or „Krok 2" (steps). */
  caption: string
  /** The enlarged image's accessible name. */
  alt: string
}

// A horizontal drag longer than this flips to the neighbouring photo.
const SWIPE_PX = 50

/**
 * The full-screen photo viewer shared by the gallery and the step photos: one
 * image at a time (object-contain on black), a caption top-left, arrow keys /
 * buttons and a horizontal swipe between items (wrapping), Escape or × to close.
 * `index` is the open item (null = closed) and the caller owns it, so the same
 * viewer serves a grid of photos or a step's single photo.
 */
export function ImageLightbox({
  items,
  index,
  onIndex,
  label,
}: {
  items: LightboxItem[]
  index: number | null
  onIndex: (index: number | null) => void
  label: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const swipeStartX = useRef<number | null>(null)
  const count = items.length
  const step = (delta: number) => onIndex(index == null ? index : (index + delta + count) % count)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (index != null && !dialog.open) dialog.showModal()
    if (index == null && dialog.open) dialog.close()
  }, [index])

  const current = index != null ? items[index] : null

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      // Esc closes a modal dialog natively; keep the state in step with it.
      onClose={() => onIndex(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') step(1)
        if (e.key === 'ArrowLeft') step(-1)
      }}
      onPointerDown={(e) => {
        swipeStartX.current = e.clientX
      }}
      onPointerUp={(e) => {
        const start = swipeStartX.current
        swipeStartX.current = null
        if (start == null) return
        const dx = e.clientX - start
        if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1)
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black/80"
    >
      {current && (
        <div className="relative h-full w-full">
          <Image
            src={current.src}
            alt={current.alt}
            fill
            sizes="100vw"
            className="object-contain select-none"
            draggable={false}
            unoptimized={!isArchivedImageUrl(current.src)}
          />

          <p
            className="absolute top-4 left-4 rounded-full bg-black/40 px-3 py-1 text-[15px] font-bold tabular-nums"
            aria-live="polite"
          >
            {current.caption}
          </p>
          <button
            type="button"
            onClick={() => onIndex(null)}
            className="absolute top-2 right-2 rounded-full p-3 hover:bg-white/10"
            aria-label="Zamknij"
            autoFocus
          >
            <X aria-hidden="true" size={24} />
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 hover:bg-white/10"
                aria-label="Poprzednie zdjęcie"
              >
                <ChevronLeft aria-hidden="true" size={28} />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 hover:bg-white/10"
                aria-label="Następne zdjęcie"
              >
                <ChevronRight aria-hidden="true" size={28} />
              </button>
            </>
          )}
        </div>
      )}
    </dialog>
  )
}
