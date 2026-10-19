'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { tagLabel } from '@/lib/recipe-tags'
import { useListTransition } from './list-transition'

interface ActiveTagFilterProps {
  tag: string
}

/** The tag the list is filtered by (set from a tag link on a recipe page), with a link that drops it. */
export function ActiveTagFilter({ tag }: ActiveTagFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { startTransition } = useListTransition()
  const params = new URLSearchParams(searchParams.toString())
  params.delete('tag')
  const query = params.toString()
  const href = query ? `/recipes?${query}` : '/recipes'

  return (
    <div className="flex items-center gap-2 text-[16px] text-ink-soft">
      <span>Tag:</span>
      <Link
        href={href}
        // A plain click navigates inside the list's transition, so the results dim
        // while they reload; new-tab clicks and no-JS keep the ordinary link.
        onNavigate={(e) => {
          e.preventDefault()
          startTransition(() => router.push(href))
        }}
        aria-label={`Usuń filtr tagu ${tagLabel(tag)}`}
        // #c2410c with white text (never orange-500), a 48 px target, no link underline.
        className="inline-flex min-h-[48px] items-center gap-1.5 rounded-pill bg-action px-4 text-[16px] font-bold text-white no-underline! transition-colors hover:bg-action-hover"
      >
        {tagLabel(tag)}
        <X aria-hidden="true" size={18} strokeWidth={2.5} />
      </Link>
    </div>
  )
}
