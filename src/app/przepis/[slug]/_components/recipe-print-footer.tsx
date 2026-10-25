import { formatSource, type RecipeSource } from '@/lib/recipe-source'

interface RecipePrintFooterProps {
  sourceType: RecipeSource
  sourceUrl: string | null
  sourceAuthor: string | null
  /** The canonical recipe URL; the protocol is dropped for a shorter printed line. */
  canonicalUrl: string
}

/**
 * The one line a printed recipe sheet carries at the bottom (owner decision
 * 2026-10-25): where the recipe came from and the address to find it again. Shown
 * only on paper (`hidden print:block`) — on screen the source lives on the photo
 * badge and the address is the page's own URL.
 */
export function RecipePrintFooter({ sourceType, sourceUrl, sourceAuthor, canonicalUrl }: RecipePrintFooterProps) {
  const source = formatSource(sourceType, sourceUrl, sourceAuthor)
  return (
    <div className="mt-8 hidden border-t border-black pt-3 text-[14px] text-black print:block">
      Źródło: {source.text} · {canonicalUrl.replace(/^https?:\/\//, '')}
    </div>
  )
}
