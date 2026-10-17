'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'

interface RecipeGalleryProps {
  images: string[]
  title: string
}

// A horizontal drag longer than this flips to the neighbouring photo.
const SWIPE_PX = 50

/** Thumbnail grid of a recipe's photos; a tap opens them full-screen. */
export function RecipeGallery({ images, title }: RecipeGalleryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const swipeStartX = useRef<number | null>(null)
  const [index, setIndex] = useState<number | null>(null)

  const count = images.length
  const step = (delta: number) => setIndex((i) => (i == null ? i : (i + delta + count) % count))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (index != null && !dialog.open) dialog.showModal()
    if (index == null && dialog.open) dialog.close()
  }, [index])

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Zdjęcia</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {images.map((src, i) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="relative block w-full aspect-square rounded-lg overflow-hidden bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
              aria-label={`Powiększ zdjęcie ${i + 1} z ${count}`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 240px"
                className="object-cover hover:scale-105 transition-transform"
                unoptimized={!isArchivedImageUrl(src)}
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={`${title} — zdjęcia`}
        // Esc closes a modal dialog natively; keep the state in step with it.
        onClose={() => setIndex(null)}
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
        {index != null && (
          <div className="relative h-full w-full">
            <Image
              src={images[index]}
              alt={`${title} — zdjęcie ${index + 1} z ${count}`}
              fill
              sizes="100vw"
              className="object-contain select-none"
              draggable={false}
              unoptimized={!isArchivedImageUrl(images[index])}
            />

            <p className="absolute top-4 left-4 text-sm tabular-nums text-white/80" aria-live="polite">
              {index + 1} / {count}
            </p>
            <button
              type="button"
              onClick={() => setIndex(null)}
              className="absolute top-2 right-2 rounded-full p-3 hover:bg-white/10"
              aria-label="Zamknij"
              autoFocus
            >
              <X aria-hidden="true" size={24} />
            </button>
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
          </div>
        )}
      </dialog>
    </section>
  )
}
