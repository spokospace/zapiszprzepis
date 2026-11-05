import { Tag } from 'lucide-react'
import { CAROUSEL_SIZES, RecipeCard } from '@/app/components/recipe-card'
import { CardCarousel } from '@/app/components/card-carousel'
import { tagLabel } from '@/lib/recipe-tags'
import { categoryPath } from '@/lib/routes'

interface Card {
  id: number
  slug: string
  title: string
  image_url: string | null
  category: string
  description: string | null
  source_type: never
  source_url: string | null
  source_author: string | null
}

/** The recipe page's tag pills and "Podobne" carousel, with the real cards and hearts. */
export function SimilarBlock({ category, tags, cards }: { category: string; tags: string[]; cards: Card[] }) {
  return (
    <div className="mb-12 border-t border-border-card pt-8">
      {tags.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-[24px] font-bold text-ink">Zobacz więcej przepisów:</h2>
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <a
                  href={categoryPath(category, { tags: [tag] })}
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-pill border-2 border-ink bg-white px-4 text-[18px] font-bold text-ink no-underline!"
                >
                  <Tag aria-hidden="true" className="h-5 w-5 shrink-0" />
                  {tagLabel(tag)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2 className="mb-4 text-[24px] font-bold text-ink">Podobne</h2>
      <CardCarousel
        label="Podobne przepisy"
        items={cards.map((r) => ({
          key: r.id,
          card: (
            <RecipeCard
              slug={r.slug}
              title={r.title}
              imageUrl={r.image_url}
              category={r.category}
              description={r.description}
              sourceType={r.source_type}
              sourceUrl={r.source_url}
              sourceAuthor={r.source_author}
              favorite={{ recipeId: r.id, favorited: false, isAuthenticated: false }}
              photo="carousel"
              sizes={CAROUSEL_SIZES}
            />
          ),
        }))}
      />
    </div>
  )
}
