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
    <div className="flex items-center gap-2 text-sm text-gray-600">
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
        className="inline-flex -skew-x-12 items-center px-3 py-0.5 bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition"
      >
        <span className="inline-flex skew-x-12 items-center gap-1">
          {tagLabel(tag)}
          <X size={12} strokeWidth={2.5} />
        </span>
      </Link>
    </div>
  )
}
