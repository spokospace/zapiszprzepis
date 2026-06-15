import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Clock, Flame, Timer, type LucideIcon } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { Toast } from '@/app/components/toast'
import { refreshRecipe } from './refresh-action'
import { formatMinutes } from '@/lib/format-minutes'
import { parseIngredients, groupBySection } from '@/lib/ingredients'
import type { Database } from '@/lib/supabase.types'

function TimeBadge({ icon: Icon, label, minutes }: { icon: LucideIcon; label: string; minutes: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden="true" size={16} className="text-orange-500" />
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium">{formatMinutes(minutes)}</span>
    </span>
  )
}

type Recipe = Database['public']['Tables']['recipes']['Row']

const SOURCE_LABELS: Partial<Record<Recipe['source_type'], string>> = {
  facebook_text: 'Facebook',
  facebook_reel: 'Facebook',
  web_blog: 'Blog',
  youtube: 'YouTube',
}

export const metadata = {
  title: 'Przepis',
  description: 'Szczegóły przepisu',
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
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !recipe) {
    console.error('[recipe] Query error:', error)
    notFound()
  }

  const typedRecipe = recipe as Recipe

  // Parse + group the jsonb ingredients. parseIngredients is crash-safe (an RSC
  // exception is a full page crash); groupBySection splits by optional `section`.
  const ingredientGroups = groupBySection(parseIngredients(typedRecipe.ingredients))

  const steps = (Array.isArray(typedRecipe.steps)
    ? typedRecipe.steps
    : JSON.parse(typedRecipe.steps as string)) as string[]

  const cat = RECIPE_CATEGORIES.find((c) => c.value === typedRecipe.category)

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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/recipes" className="inline-flex items-center text-orange-600 hover:text-orange-700 mb-8">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Powrót
        </Link>

        {typedRecipe.image_url && (
          <div className="relative w-full h-96 rounded-lg overflow-hidden mb-8">
            <Image
              src={typedRecipe.image_url}
              alt={typedRecipe.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{typedRecipe.title}</h1>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/recipes?category=${typedRecipe.category}`}
              className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full hover:bg-orange-200 transition"
            >
              <span>{cat ? cat.label : typedRecipe.category}</span>
            </Link>
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
              {SOURCE_LABELS[typedRecipe.source_type] ?? 'Inny'}
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
          {(typedRecipe.prep_time_minutes != null
            || typedRecipe.cook_time_minutes != null
            || typedRecipe.total_time_minutes != null) && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-700">
              {typedRecipe.prep_time_minutes != null && (
                <TimeBadge icon={Clock} label="Przygotowanie" minutes={typedRecipe.prep_time_minutes} />
              )}
              {typedRecipe.cook_time_minutes != null && (
                <TimeBadge icon={Flame} label="Gotowanie" minutes={typedRecipe.cook_time_minutes} />
              )}
              {typedRecipe.total_time_minutes != null && (
                <TimeBadge icon={Timer} label="Łącznie" minutes={typedRecipe.total_time_minutes} />
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
            <ol className="space-y-4">
              {steps.map((step: string, idx: number) => (
                <li key={idx} className="flex gap-4">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-semibold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-gray-700 pt-1">{step}</p>
                </li>
              ))}
            </ol>
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
      </div>
    </div>
  )
}
