import Image from 'next/image'
import { categoryLabel } from '@/lib/recipe-categories'
import { coverImageSrc } from '@/lib/recipe-image-archive'
import { NoPhoto } from '@/app/components/no-photo'

/**
 * The inner content of one „Podpowiedź” row — a 48 px thumbnail, the title and the
 * category — shared by the /szukaj page suggestions (inside a link) and the desktop
 * header search panel (inside a combobox option). The caller owns the row wrapper.
 */
export function SuggestionRowContent({
  title,
  category,
  imageUrl,
}: {
  title: string
  category: string
  imageUrl: string | null
}) {
  const cover = coverImageSrc(imageUrl)
  return (
    <>
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-tile bg-surface-3">
        {cover ? (
          <Image
            src={cover}
            // The title sits right beside it, so the thumbnail is decorative.
            alt=""
            aria-hidden
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <NoPhoto category={category} iconClassName="h-6 w-6" />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[19px] leading-snug font-bold wrap-anywhere">{title}</span>
        <span className="text-[16px] text-ink-soft">{categoryLabel(category)}</span>
      </span>
    </>
  )
}
