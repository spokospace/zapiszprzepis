import Link from 'next/link'
import { LAB_SLUGS } from '../slugs'

export const revalidate = false
export const metadata = { title: 'Recipe lab', robots: { index: false, follow: false } }

/** A source page for the spec A click test: real `<Link>`s into the lab recipe route. */
export default function LabIndex() {
  return (
    <main className="p-8">
      <ul>
        {LAB_SLUGS.map((slug) => (
          <li key={slug}>
            <Link href={`/lab/przepis/${slug}`}>{slug}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
