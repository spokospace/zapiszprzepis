import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/staff/context'
import { readFlash } from '@/lib/staff/flash'
import { DELETE_RECIPE_CONFIRMATION, getRecipe, listMerges, parseRecipeId } from '@/lib/staff/recipes'
import { categoryLabel, RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { MAX_TAGS, RECIPE_TAGS } from '@/lib/recipe-tags'
import { recipePath } from '@/lib/routes'
import { Banner, buttonClass, buttonDangerClass, buttonOutlineClass, fieldClass, formatWhen, PageTitle } from '../../ui'
import { deleteRecipe, hideRecipe, mergeRecipes, setTaxonomy, unhideRecipe, unmergeRecipes } from '../actions'

const OK_MESSAGES = {
  hidden: 'Przepis jest ukryty. Goście i użytkownicy go nie widzą.',
  unhidden: 'Przepis znów jest widoczny.',
  restored: 'Przepis został przywrócony.',
  merged: 'Duplikaty zostały scalone z tym przepisem. Ich adresy przekierowują tutaj.',
  unmerged: 'Scalenie cofnięte. Duplikaty wróciły pod swoimi numerami.',
  taxonomy: 'Kategoria i tagi zapisane.',
} as const

type SearchParams = { ok?: string; error?: string }

/** The few fields of the source the detail page previews, read through the staff SELECT policy on recipes. */
type SourcePreview = {
  description: string | null
  source_author: string | null
  tags: string[]
  ingredients: unknown
  steps: unknown
}

export default async function RecipeAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const staff = await requirePermission('recipes.read')
  const id = parseRecipeId((await params).id)
  if (id === null) notFound()
  const flashParams = await searchParams

  const recipe = await getRecipe(staff.supabase, id)
  if (!recipe) notFound()

  const canHide = staff.permissions.has('recipes.hide')
  const canDelete = staff.permissions.has('recipes.delete')
  const canMerge = staff.permissions.has('recipes.merge')
  const canTaxonomy = staff.permissions.has('recipes.taxonomy')

  const [{ data: previewRow }, merges] = await Promise.all([
    staff.supabase.from('recipes').select('description, source_author, tags, ingredients, steps').eq('id', id).maybeSingle(),
    canMerge ? listMerges(staff.supabase, id) : Promise.resolve([]),
  ])
  const preview = previewRow as SourcePreview | null
  const tags = new Set(preview?.tags ?? [])
  const count = (value: unknown) => (Array.isArray(value) ? value.length : 0)

  return (
    <>
      <p className="mb-2">
        <Link href="/admin/przepisy" className="min-h-touch inline-flex items-center underline underline-offset-4">
          ← Wszystkie przepisy
        </Link>
      </p>
      <PageTitle>{recipe.title || recipe.slug}</PageTitle>
      <Banner flash={readFlash(flashParams, OK_MESSAGES)} />

      <dl className="mb-6 grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="text-ink-soft">Numer</dt>
        <dd>#{recipe.id}</dd>
        <dt className="text-ink-soft">Adres</dt>
        <dd className="break-all">
          <Link href={recipePath(recipe.slug)} className="underline underline-offset-4">
            {recipePath(recipe.slug)}
          </Link>
        </dd>
        <dt className="text-ink-soft">Autor</dt>
        <dd>
          {recipe.ownerUsername ? (
            <Link href={`/admin/uzytkownicy/${recipe.ownerId}`} className="underline underline-offset-4">
              @{recipe.ownerUsername}
            </Link>
          ) : (
            '—'
          )}
        </dd>
        <dt className="text-ink-soft">Kategoria</dt>
        <dd>{categoryLabel(recipe.category)}</dd>
        <dt className="text-ink-soft">Dodany</dt>
        <dd>{formatWhen(recipe.createdAt)}</dd>
        <dt className="text-ink-soft">Zmieniony</dt>
        <dd>{formatWhen(recipe.updatedAt)}</dd>
        <dt className="text-ink-soft">Ulubione</dt>
        <dd>{recipe.favoriteCount}</dd>
        <dt className="text-ink-soft">Stan</dt>
        <dd>
          {recipe.hiddenAt ? (
            <>
              <strong className="text-danger">Ukryty</strong> od {formatWhen(recipe.hiddenAt)}
              {recipe.hiddenReason ? ` · ${recipe.hiddenReason}` : ''}
            </>
          ) : (
            'Widoczny'
          )}
        </dd>
      </dl>

      <section aria-labelledby="source-heading" className="mb-8 max-w-xl">
        <h2 id="source-heading" className="mb-2 text-xl font-semibold">
          Źródło
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-ink-soft">Rodzaj</dt>
          <dd>{recipe.sourceType}</dd>
          <dt className="text-ink-soft">Adres</dt>
          <dd className="break-all">
            {recipe.sourceUrl ? (
              <a href={recipe.sourceUrl} rel="noopener noreferrer nofollow" target="_blank" className="underline underline-offset-4">
                {recipe.sourceUrl}
              </a>
            ) : (
              '—'
            )}
          </dd>
          <dt className="text-ink-soft">Autor źródła</dt>
          <dd>{preview?.source_author ?? '—'}</dd>
          <dt className="text-ink-soft">Treść</dt>
          <dd>
            {count(preview?.ingredients)} składników, {count(preview?.steps)} kroków
          </dd>
        </dl>
        {preview?.description && <p className="mt-3 text-ink-soft">{preview.description}</p>}
      </section>

      {canHide && (
        <section aria-labelledby="hide-heading" className="mb-8 max-w-xl">
          <h2 id="hide-heading" className="mb-2 text-xl font-semibold">
            {recipe.hiddenAt ? 'Odkryj przepis' : 'Ukryj przepis'}
          </h2>
          {recipe.hiddenAt ? (
            <form action={unhideRecipe}>
              <input type="hidden" name="id" value={recipe.id} />
              <button type="submit" className={buttonOutlineClass}>
                Odkryj przepis
              </button>
            </form>
          ) : (
            <form action={hideRecipe} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={recipe.id} />
              <p>
                Goście i użytkownicy przestają widzieć przepis. Autor i osoby z nim w ulubionych zobaczą „Przepis jest
                niedostępny”. Możesz go odkryć w każdej chwili.
              </p>
              <label htmlFor="reason" className="font-semibold">
                Powód (nieobowiązkowo, trafia do dziennika)
              </label>
              <input id="reason" name="reason" type="text" maxLength={200} className={fieldClass} />
              <button type="submit" className={`${buttonDangerClass} self-start`}>
                Ukryj przepis
              </button>
            </form>
          )}
        </section>
      )}

      {canTaxonomy && (
        <section aria-labelledby="taxonomy-heading" className="mb-8 max-w-xl">
          <h2 id="taxonomy-heading" className="mb-2 text-xl font-semibold">
            Kategoria i tagi
          </h2>
          <form action={setTaxonomy} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={recipe.id} />
            <label htmlFor="category" className="font-semibold">
              Kategoria
            </label>
            <select id="category" name="category" defaultValue={recipe.category} className={fieldClass}>
              {RECIPE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 font-semibold">Tagi (najwyżej {MAX_TAGS})</legend>
              {RECIPE_TAGS.map((t) => (
                <label key={t.value} className="min-h-touch flex items-center gap-3">
                  <input type="checkbox" name="tags" value={t.value} defaultChecked={tags.has(t.value)} className="size-6" />
                  <span>{t.label}</span>
                </label>
              ))}
            </fieldset>
            <button type="submit" className={`${buttonClass} self-start`}>
              Zapisz
            </button>
          </form>
        </section>
      )}

      {canMerge && (
        <section aria-labelledby="merge-heading" className="mb-8 max-w-xl">
          <h2 id="merge-heading" className="mb-2 text-xl font-semibold">
            Scal duplikaty
          </h2>
          <form action={mergeRecipes} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={recipe.id} />
            <p>
              Podane przepisy znikają, a ten zostaje. Ich ulubione i udostępnienia przechodzą tutaj, a stare adresy
              przekierowują na ten przepis. Scalenie można cofnąć niżej.
            </p>
            <label htmlFor="losers" className="font-semibold">
              Numery duplikatów (po przecinku, najwyżej 20)
            </label>
            <input id="losers" name="losers" type="text" inputMode="numeric" autoComplete="off" className={fieldClass} />
            <label htmlFor="merge-confirm" className="font-semibold">
              Aby potwierdzić, wpisz SCAL
            </label>
            <input id="merge-confirm" name="confirm" type="text" autoComplete="off" className={fieldClass} />
            <button type="submit" className={`${buttonDangerClass} self-start`}>
              Scal duplikaty
            </button>
          </form>

          {merges && merges.length > 0 && (
            <>
              <h3 className="mt-6 mb-2 text-lg font-semibold">Scalenia tego przepisu</h3>
              <ul className="flex flex-col gap-3">
                {merges.map((m) => (
                  <li key={m.mergeId} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-card pb-3">
                    <span className="min-w-0 flex-1 break-all">
                      {formatWhen(m.mergedAt)} · {m.loserSlugs.join(', ')}
                    </span>
                    <form action={unmergeRecipes}>
                      <input type="hidden" name="id" value={recipe.id} />
                      <input type="hidden" name="mergeId" value={m.mergeId} />
                      <button type="submit" className={buttonOutlineClass}>
                        Cofnij scalenie
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-ink-soft">
                Cofnięty duplikat wraca bez linku źródłowego, jeśli ten przepis go ma: link może należeć tylko do jednego
                przepisu.
              </p>
            </>
          )}
        </section>
      )}

      {canDelete && (
        <section aria-labelledby="delete-heading" className="max-w-xl">
          <h2 id="delete-heading" className="mb-2 text-xl font-semibold">
            Usuń przepis
          </h2>
          <form action={deleteRecipe} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={recipe.id} />
            <p>
              Przepis znika, razem z {recipe.favoriteCount} {recipe.favoriteCount === 1 ? 'ulubionym' : 'ulubionymi'}.
              Kopia zostaje w archiwum i możesz go przywrócić z listy przepisów, ale ulubione nie wrócą.
            </p>
            <label htmlFor="redirect" className="font-semibold">
              Przekieruj stary adres do innego przepisu (nieobowiązkowo)
            </label>
            <input
              id="redirect"
              name="redirect"
              type="text"
              placeholder="adres-innego-przepisu"
              autoComplete="off"
              className={fieldClass}
            />
            <label htmlFor="confirm" className="font-semibold">
              Aby potwierdzić, wpisz {DELETE_RECIPE_CONFIRMATION}
            </label>
            <input id="confirm" name="confirm" type="text" autoComplete="off" className={fieldClass} />
            <button type="submit" className={`${buttonClass} self-start bg-danger hover:bg-danger`}>
              Usuń przepis
            </button>
          </form>
        </section>
      )}
    </>
  )
}
