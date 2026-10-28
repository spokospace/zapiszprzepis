'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'

interface RecipePhotosProps {
  /** The recipe's main photo (the archived cover). */
  cover: string
  title: string
  /** The gallery photos a signed-in reader can see; empty for a guest. */
  images: string[]
  /** The source badge, pinned to the bottom-left corner of the main photo. */
  badge: ReactNode
}

/** The photos in thumbnail order: the cover first, then the gallery, each URL once. */
export function photoList(cover: string, images: string[]): string[] {
  return [...new Set([cover, ...images])]
}

/** The main photo's alt: the recipe title for the cover, numbered for a gallery photo. */
export function photoAlt(title: string, selected: number, total: number): string {
  return selected === 0 ? title : `${title} — zdjęcie ${selected + 1} z ${total}`
}

/**
 * The recipe's photos (handoff 2026-10-28): a 4:3 main photo with the source badge, and a
 * row of thumbnails under it — the cover first, then the gallery. A tap on a thumbnail
 * swaps the main photo; each thumbnail is a toggle (`aria-pressed`) with its own name.
 * A guest gets only the cover: the gallery is a login perk (A1), so the locked teaser
 * below the steps stands in for it.
 */
export function RecipePhotos({ cover, title, images, badge }: RecipePhotosProps) {
  const all = photoList(cover, images)
  const [selected, setSelected] = useState(0)
  const current = all[selected] ?? cover

  return (
    // The cover bleeds to the screen edges below lg and to the left browser edge from lg,
    // exactly as the header's cover did; the negative margins mirror PageContainer and
    // <main>'s padding (see recipe-header.tsx).
    <div className="recipe-print-cover relative mb-5 -mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:mr-0 lg:mb-0 lg:bleed-left-page xl:row-span-2">
      <div className="relative aspect-[4/3]">
        <div className="absolute inset-0 overflow-hidden bg-surface-3 lg:rounded-r-tile">
          <Image
            // The LCP image is the cover; a swapped-in gallery photo is never the LCP.
            src={current}
            alt={photoAlt(title, selected, all.length)}
            fill
            // Full-bleed = 100vw below lg (1024); from lg the column plus the bleed,
            // ~37–40vw up to 1535 px and ~44vw on very wide screens.
            sizes="(max-width: 1023px) 100vw, (max-width: 1535px) 40vw, 45vw"
            className="object-cover"
            priority={selected === 0}
            unoptimized={!isArchivedImageUrl(current)}
          />
          {/* Source on the photo, bottom-left (E01-S31 §3). Hidden on print — the printout
              carries the source in its footer line instead. */}
          <div className="absolute bottom-0 left-px z-10 max-w-[calc(100%-1px)] print:hidden">{badge}</div>
        </div>
      </div>

      {all.length > 1 && (
        <ul aria-label="Zdjęcia przepisu" className="mt-3 grid grid-cols-4 gap-2.5 px-4 sm:px-6 lg:px-0 print:hidden">
          {all.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                aria-pressed={i === selected}
                aria-label={`Pokaż zdjęcie ${i + 1} z ${all.length}`}
                onClick={() => setSelected(i)}
                className={`relative block aspect-[4/3] w-full overflow-hidden bg-surface-3 border-[3px] ${
                  i === selected ? 'border-ink' : 'border-transparent'
                }`}
              >
                <Image
                  src={src}
                  // The button is named, so the thumbnail is decorative.
                  alt=""
                  aria-hidden
                  fill
                  sizes="120px"
                  className="object-cover"
                  unoptimized={!isArchivedImageUrl(src)}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
