'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { tagLabel } from '@/lib/recipe-tags'

interface ActiveTagFilterProps {
  tag: string
}

/** The tag the list is filtered by (set from a tag link on a recipe page), with a link that drops it. */
export function ActiveTagFilter({ tag }: ActiveTagFilterProps) {
  const searchParams = useSearchParams()
  const params = new URLSearchParams(searchParams.toString())
  params.delete('tag')
  const query = params.toString()

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span>Tag:</span>
      <Link
        href={query ? `/recipes?${query}` : '/recipes'}
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
