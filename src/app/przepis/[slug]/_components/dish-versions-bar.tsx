import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import { polishPlural } from '@/lib/recipe-meta'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'

/** "1 inna wersja tego dania", "3 inne wersje …", "9 innych wersji …". */
export function versionsBoxLabel(n: number): string {
  return `${n} ${polishPlural(n, 'inna wersja', 'inne wersje', 'innych wersji')} tego dania`
}

/**
 * "np. bez drożdży, z serem, z air fryera" from the versions' notes, or null without any.
 * The notes are stored sentence-case ("Z oliwą i sezamem"); mid-sentence they start lower.
 */
export function versionsExamples(examples: string[]): string | null {
  if (examples.length === 0) return null
  return `np. ${examples.map((note) => note.charAt(0).toLocaleLowerCase('pl-PL') + note.slice(1)).join(', ')}`
}

/**
 * The shortcut to the other versions (E01-S21; handoff 2026-10-28 §3 item 7): a framed
 * row under the actions — up to three overlapping round thumbnails, "N innych wersji tego
 * dania" (underlined: it is a link), a line of example differences, and a chevron. One
 * native anchor to the versions section, so it works without JS; the section heading
 * takes focus. Rendered only when the dish has at least one other recipe.
 */
export function DishVersionsBar({ count, thumbs = [], examples = [] }: { count: number; thumbs?: string[]; examples?: string[] }) {
  if (count < 1) return null
  const hint = versionsExamples(examples)
  return (
    <a
      href="#inne-przepisy"
      className="mt-5 flex min-h-[64px] items-center gap-4 rounded-tile border border-border-card px-4 py-3 text-ink no-underline! hover:bg-surface-2"
    >
      {thumbs.length > 0 && (
        <span aria-hidden="true" className="flex shrink-0">
          {thumbs.map((src, i) => (
            <Image
              key={src}
              src={src}
              alt=""
              width={40}
              height={40}
              className={`h-10 w-10 rounded-pill border-2 border-white bg-surface-3 object-cover ${i > 0 ? '-ml-3' : ''}`}
              unoptimized={!isArchivedImageUrl(src)}
            />
          ))}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold underline wrap-anywhere">{versionsBoxLabel(count)}</span>
        {hint && <span className="block text-[16px] text-ink-soft wrap-anywhere">{hint}</span>}
      </span>
      <ChevronDown aria-hidden="true" size={22} className="shrink-0 text-ink-soft" />
    </a>
  )
}
