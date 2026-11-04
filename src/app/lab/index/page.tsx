import Link from 'next/link'
import { getRecentPublicRecipes } from '@/lib/recipe-cache'

export const revalidate = 3600
export const metadata = { title: 'Recipe lab', robots: { index: false, follow: false } }

/** A source page for the spec A click test: real `<Link>`s into the lab recipe route. */
export default async function LabIndex() {
  const recipes = await getRecentPublicRecipes(4)
  return (
    <main className="p-8">
      <ul>
        {recipes.map((r) => (
          <li key={r.slug}>
            <Link href={`/lab/przepis/${r.slug}`}>{r.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
