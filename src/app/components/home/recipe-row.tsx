import Link from 'next/link'
import { CAROUSEL_SIZES, RecipeCard } from '@/app/components/recipe-card'
import { CardCarousel } from '@/app/components/card-carousel'
import { RecipeListSnapshot } from '@/app/components/recipe-list-snapshot'
import type { MyRecipeCard } from '@/lib/my-recipes'
import type { ListKey } from '@/lib/recipe-list-context'

/**
 * A row of recipe cards under a heading (E01-S31 §2, §5): the swipeable strip on a
 * phone, one grid row from lg, with an optional "Wszystkie … →" link under it.
 */
export function RecipeRow({
  id,
  heading,
  listKey,
  href,
  recipes,
  more,
}: {
  id: string
  heading: string
  /** Lets the recipe page show "← {heading}" + prev/next (E01-S07). */
  listKey: ListKey
  /** Where that "←" goes back to. */
  href: string
  recipes: MyRecipeCard[]
  more?: { href: string; label: string }
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-4 border-t border-ink pt-5 text-[28px] font-bold text-ink">
        {heading}
      </h2>
      <RecipeListSnapshot
        listKey={listKey}
        label={heading}
        href={href}
        items={recipes.map((r) => ({ slug: r.slug, title: r.title }))}
      />
      <CardCarousel
        label={heading}
        items={recipes.map((r) => ({
          // id, not slug: a row can span users, and the id is the stable key.
          key: r.id,
          card: (
            <RecipeCard
              from={listKey}
              slug={r.slug}
              title={r.title}
              imageUrl={r.image_url}
              category={r.category}
              description={r.description}
              sourceType={r.source_type}
              sourceUrl={r.source_url}
              sourceAuthor={r.source_author}
              photo="carousel"
              sizes={CAROUSEL_SIZES}
              favorite={{ recipeId: r.id }}
            />
          ),
        }))}
      />
      {more && (
        <Link
          href={more.href}
          className="mt-4 inline-flex min-h-12 items-center text-[18px] font-bold text-action-text underline underline-offset-4 hover:text-action-hover"
        >
          {more.label}
        </Link>
      )}
    </section>
  )
}
