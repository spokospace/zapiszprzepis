import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Clock, Flame, Timer, type LucideIcon } from 'lucide-react'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { categoryLabel } from '@/lib/recipe-categories'
import { buildFallbackMetaDescription, tagLabel } from '@/lib/recipe-tags'
import { sourceLabel } from '@/lib/recipe-source'
import { Toast } from '@/app/components/toast'
import { PageContainer } from '@/app/components/page-container'
import { RecipeGallery } from '@/app/components/recipe-gallery'
import { refreshRecipe } from './refresh-action'
import { formatMinutes } from '@/lib/format-minutes'
import { cookTimeLabel } from '@/lib/cook-time-label'
import { parseIngredients, groupBySection } from '@/lib/ingredients'
import { parseSteps } from '@/lib/steps'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import type { Database } from '@/lib/supabase.types'

function TimeBadge({
  icon: Icon,
  label,
  minutes,
  estimated,
}: {
  icon: LucideIcon
  label: string
  minutes: number
  estimated: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden="true" size={16} className="text-orange-500" />
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium" title={estimated ? 'Co najmniej jeden z czasów przepisu jest szacowany' : undefined}>
        {estimated && (
          <>
            <span aria-hidden="true">≈ </span>
            <span className="sr-only">około </span>
          </>
        )}
        {formatMinutes(minutes)}
      </span>
    </span>
  )
}

/**
 * A chip that links for a signed-in visitor and is a plain label for a guest: its
 * filter targets "/recipes" (Moje przepisy, owner-only), which would bounce a
 * guest to /login. One class string, so the two variants cannot drift.
 */
function MaybeLink({
  href,
  className,
  hoverClassName,
  children,
}: {
  href: string | null
  className: string
  hoverClassName: string
  children: React.ReactNode
}) {
  return href ? (
    <Link href={href} className={`${className} ${hoverClassName}`}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  )
}

type Recipe = Database['public']['Tables']['recipes']['Row']

/** A row of the guest-safe public_recipes view: no user_id, no gallery, plus the author. */
type PublicRecipe = Omit<Recipe, 'user_id' | 'image_urls' | 'source_fingerprint' | 'extracted_at' | 'updated_at'> & {
  author_name: string | null
}

/**
 * One guest-safe read of the recipe for this slug, shared by generateMetadata
 * and the page through React cache() so a single render hits the DB once.
 * Everyone reads through the public_recipes view (recipes itself is owner-only
 * RLS). Slugs are unique per user only, so one slug can resolve to several rows:
 * prefer the signed-in visitor's own, else the oldest. (A globally unique slug
 * arrives with E01-S03.)
 */
const loadRecipe = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  const [{ data: candidates, error }, { data: own }] = await Promise.all([
    supabase
      .from('public_recipes')
      .select('*')
      .eq('slug', slug)
      .order('created_at', { ascending: true })
      // A guest always takes the first row; only a signed-in visitor looks for their own.
      .limit(user ? 10 : 1),
    user
      ? supabase.from('recipes').select('id').eq('slug', slug).eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const rows = (candidates ?? []) as PublicRecipe[]
  const recipe = rows.find((r) => r.id === own?.id) ?? rows[0] ?? null
  // Refresh/delete are the owner's; a guest or another user only reads.
  return { recipe, error, isOwner: own?.id != null && recipe?.id === own.id, user }
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  // Crawlers and link-preview bots are anonymous, so the metadata describes what
  // a guest sees; meta_description falls back to a self-derived sentence.
  const { recipe } = await loadRecipe(slug)
  if (!recipe) return { title: 'Przepis', description: 'Szczegóły przepisu' }

  const description = recipe.meta_description ?? buildFallbackMetaDescription(recipe)
  const images = recipe.image_url ? [recipe.image_url] : undefined
  return {
    title: recipe.title,
    description,
    openGraph: {
      title: recipe.title,
      description,
      type: 'article',
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: recipe.title,
      description,
    },
  }
}

interface RecipeDetailPageProps {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    duplicate?: string
    refreshing?: string
    refresh_error?: string
  }>
}

export default async function RecipeDetailPage({ params, searchParams }: RecipeDetailPageProps) {
  const { slug } = await params
  const { duplicate, refreshing, refresh_error } = await searchParams

  const { recipe: typedRecipe, error, isOwner, user } = await loadRecipe(slug)

  if (error || !typedRecipe) {
    if (error) console.error('[recipe] Query error:', error)
    notFound()
  }

  // The gallery is a login perk (decision Q3). recipe_gallery_images is granted to
  // signed-in users only, so a guest cannot read it through the API either.
  let galleryImages: string[] = []
  if (user) {
    const supabase = await createSupabaseServerClient()
    const { data: gallery } = await supabase
      .from('recipe_gallery_images')
      .select('image_urls')
      .eq('id', typedRecipe.id)
      .maybeSingle()
    galleryImages = gallery?.image_urls ?? []
  }

  // Parse the jsonb ingredients and steps. Both parsers are crash-safe (an RSC
  // exception is a full page crash, which would also hide the delete button);
  // groupBySection splits ingredients by optional `section`.
  const ingredientGroups = groupBySection(parseIngredients(typedRecipe.ingredients))
  const steps = parseSteps(typedRecipe.steps)

  return (
    <div className="min-h-screen bg-white py-8">
      {duplicate === '1' && (
        <Toast message="Ten przepis już masz." type="info" duration={5000} clearParam="duplicate" />
      )}
      {refreshing === '1' && (
        <Toast message="Odświeżam przepis — zmiany pojawią się za chwilę." type="success" duration={5000} clearParam="refreshing" />
      )}
      {refresh_error === '1' && (
        <Toast message="Nie można odświeżyć — przepis nie ma źródłowego adresu." type="error" duration={5000} clearParam="refresh_error" />
      )}
      <PageContainer narrow>
        {typedRecipe.image_url && (
          <div className="relative w-full aspect-[4/3] sm:aspect-video rounded-lg overflow-hidden mb-8">
            <Image
              src={typedRecipe.image_url}
              alt={typedRecipe.title}
              fill
              className="object-cover"
              priority
              unoptimized={!isArchivedImageUrl(typedRecipe.image_url)}
            />
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{typedRecipe.title}</h1>
          {typedRecipe.description && (
            <p className="-mt-2 mb-4 text-lg text-gray-500">{typedRecipe.description}</p>
          )}
          {typedRecipe.meta_description && (
            <p className="mb-5 text-lg leading-relaxed text-gray-700">{typedRecipe.meta_description}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <MaybeLink
              href={user ? `/recipes?category=${typedRecipe.category}` : null}
              className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full"
              hoverClassName="hover:bg-orange-200 transition"
            >
              {categoryLabel(typedRecipe.category)}
            </MaybeLink>
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
              {sourceLabel(typedRecipe.source_type, typedRecipe.source_url, typedRecipe.source_author)}
            </span>
            {typedRecipe.source_url && (
              <a
                href={typedRecipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full hover:bg-blue-200 transition"
              >
                Otwórz oryginał ↗
              </a>
            )}
          </div>
          {/* Gender-neutral until E01-S12 supplies gender ("Dodała/Dodał"); plain text
              until E01-S14 builds /u/{username}, so the line never links to a 404. */}
          {typedRecipe.author_name && (
            <p className="mt-3 text-base text-gray-600">
              Dodane przez <span className="font-medium text-gray-900">{typedRecipe.author_name}</span>
            </p>
          )}
          {typedRecipe.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tagi">
              {typedRecipe.tags.map((tag) => (
                // Slanted (parallelogram) badge; the inner span skews back so the text stays upright.
                <li key={tag}>
                  <MaybeLink
                    href={user ? `/recipes?tag=${tag}` : null}
                    className="inline-block -skew-x-12 px-3 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-medium"
                    hoverClassName="hover:bg-orange-100 transition"
                  >
                    <span className="inline-block skew-x-12">{tagLabel(tag)}</span>
                  </MaybeLink>
                </li>
              ))}
            </ul>
          )}
          {(typedRecipe.prep_time_minutes != null
            || typedRecipe.cook_time_minutes != null
            || typedRecipe.total_time_minutes != null) && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-700">
              {typedRecipe.prep_time_minutes != null && (
                <TimeBadge icon={Clock} label="Przygotowanie" minutes={typedRecipe.prep_time_minutes} estimated={typedRecipe.times_estimated} />
              )}
              {typedRecipe.cook_time_minutes != null && (
                <TimeBadge icon={Flame} label={cookTimeLabel(steps)} minutes={typedRecipe.cook_time_minutes} estimated={typedRecipe.times_estimated} />
              )}
              {typedRecipe.total_time_minutes != null && (
                <TimeBadge icon={Timer} label="Łącznie" minutes={typedRecipe.total_time_minutes} estimated={typedRecipe.times_estimated} />
              )}
              {typedRecipe.times_estimated && (
                <p className="basis-full text-xs text-gray-500">Co najmniej jeden z czasów jest szacowany — źródło go nie podaje.</p>
              )}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Składniki</h2>
            {ingredientGroups.map((group, gi) => (
              <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
                {group.section && (
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    {group.section}
                  </h3>
                )}
                <ul className="space-y-2">
                  {group.items.map((ingredient, idx) => (
                    <li key={idx} className="flex items-start text-gray-700">
                      <span className="inline-block w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      <span>
                        {ingredient.name}
                        {ingredient.amount && (
                          <span className="text-gray-500 ml-1">
                            — {ingredient.amount}
                            {ingredient.unit && ` ${ingredient.unit}`}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Przygotowanie</h2>
            {steps.length === 0 ? (
              <p className="text-gray-500">Brak kroków przygotowania.</p>
            ) : (
              <ol className="space-y-4">
                {steps.map((step, idx) => (
                  <li key={idx} className="flex gap-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-semibold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-gray-700 pt-1">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {typedRecipe.youtube_id && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Wideo</h2>
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${typedRecipe.youtube_id}`}
                title={`${typedRecipe.title} — wideo`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </section>
        )}

        {/* A gallery of one would only repeat the cover. galleryImages is empty for a
            guest: the gallery view is not granted to anon (decision Q3). */}
        {galleryImages.length > 1 && (
          <RecipeGallery images={galleryImages} title={typedRecipe.title} />
        )}

        {isOwner && (
          <div className="border-t pt-8 flex items-center justify-between gap-3">
            <form action={refreshRecipe}>
              <input type="hidden" name="slug" value={typedRecipe.slug} />
              <button
                type="submit"
                className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition text-sm font-medium"
              >
                Odśwież przepis
              </button>
            </form>
            <form action="/api/recipes/delete" method="POST">
              <input type="hidden" name="slug" value={typedRecipe.slug} />
              <button
                type="submit"
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium"
              >
                Usuń przepis
              </button>
            </form>
          </div>
        )}
      </PageContainer>
    </div>
  )
}
