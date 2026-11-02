import Link from 'next/link'
import { recipePath } from '@/lib/routes'

export interface PostSibling {
  id: number
  slug: string
  title: string
}

interface PostSiblingsProps {
  /** The link the dishes were read from. */
  sourceUrl: string
  /** The source's name for the link (the post's title is not stored). */
  sourceName: string
  /** The other dishes saved from the same link, in no particular order. */
  siblings: PostSibling[]
}

/**
 * "Z wpisu" and "Inne przepisy z tego wpisu" for a link that produced several
 * recipes (E01 multi-recipe, phase 4). Renders nothing without sibling rows, so a
 * single-recipe page is unchanged.
 */
export function PostSiblings({ sourceUrl, sourceName, siblings }: PostSiblingsProps) {
  if (siblings.length === 0) return null

  return (
    <section aria-labelledby="post-siblings-heading" className="mb-12">
      <p className="mb-4 text-[17px] text-ink">
        Z wpisu:{' '}
        <a href={sourceUrl} rel="noopener noreferrer" className="font-bold underline">
          {sourceName}
        </a>
      </p>
      <h2 id="post-siblings-heading" className="mb-4 text-[24px] font-bold text-ink">
        Inne przepisy z tego wpisu
      </h2>
      <ul className="flex flex-col gap-2">
        {siblings.map((sibling) => (
          <li key={sibling.id}>
            <Link
              href={recipePath(sibling.slug)}
              className="flex min-h-12 items-center rounded-lg border border-border-card px-4 py-3 text-[17px] font-bold text-ink underline"
            >
              {sibling.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
