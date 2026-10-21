'use client'

import { useState } from 'react'
import Image from 'next/image'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { ImageLightbox } from './image-lightbox'

interface RecipeGalleryProps {
  images: string[]
  title: string
}

/** Thumbnail grid of a recipe's photos; a tap opens them full-screen (ImageLightbox). */
export function RecipeGallery({ images, title }: RecipeGalleryProps) {
  const [index, setIndex] = useState<number | null>(null)
  const count = images.length

  return (
    <section className="mb-12">
      {/* Like the recipe page's other section headings (24 px, README H2). */}
      <h2 className="mb-4 text-[24px] font-bold text-ink">Zdjęcia</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {images.map((src, i) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="relative block aspect-square w-full overflow-hidden rounded-[12px] bg-surface-3"
              aria-label={`Powiększ zdjęcie ${i + 1} z ${count}`}
            >
              <Image
                src={src}
                // The button is named ("Powiększ zdjęcie i z N"), so the thumbnail is decorative.
                alt=""
                aria-hidden
                fill
                sizes="(max-width: 640px) 50vw, 240px"
                className="object-cover hover:scale-105 transition-transform"
                unoptimized={!isArchivedImageUrl(src)}
              />
            </button>
          </li>
        ))}
      </ul>

      <ImageLightbox
        label={`${title} — zdjęcia`}
        index={index}
        onIndex={setIndex}
        items={images.map((src, i) => ({ src, caption: `${i + 1} / ${count}`, alt: `${title} — zdjęcie ${i + 1} z ${count}` }))}
      />
    </section>
  )
}
