'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { TextSizeControls } from '@/app/components/ui/text-size-controls'
import { useTextScale } from '@/app/components/ui/use-text-scale'
import { useSessionStorage } from '@/app/components/ui/use-session-storage'
import { checklistStorageKey, parseChecklist, toggleChecked } from '@/lib/recipe-checklist'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { servingsLabel } from '@/lib/servings'
import { ImageLightbox } from '@/app/components/image-lightbox'
import type { Ingredient } from '@/lib/ingredients'
import { CookingMode } from './cooking-mode'

/** „Pokaż” / „Ukryj” — the two states of the step-photos toggle (ZMIANY §3). */
const PHOTO_OPTIONS: [label: string, show: boolean][] = [
  ['Pokaż', true],
  ['Ukryj', false],
]
/** Remembered globally (not per recipe), so the choice carries across recipes. */
const STEP_PHOTOS_KEY = 'stepPhotos'
/** Stable empty list so „Ukryj” hides photos without a fresh array every render. */
const NO_STEP_IMAGES: string[] = []

interface IngredientGroup {
  section: string | null
  items: Ingredient[]
}

interface RecipeChecklistsProps {
  recipeId: number
  /** Recipe title, shown at the top of cooking mode. */
  title: string
  ingredientGroups: IngredientGroup[]
  steps: string[]
  /** Archived image URL per step, index-aligned with `steps`; '' = that step has none (ZMIANY zdjęcia kroków). */
  stepImages?: string[]
  /** Servings the source states; null/undefined hides "na N porcji". */
  servings?: number | null
  /** Rendered under the steps: in the steps column from lg (video, gallery; E01-S17). */
  children?: React.ReactNode
}

/**
 * One ingredient row (handoff C3, item 8): a native checkbox restyled as a 32 px box
 * (2.5 px #4b5563 border; ticked: #15803d with a white ✓) inside its label, so the
 * whole ≥ 56 px row is the target. The name takes the row, the amount sits right in
 * bold. A ticked row is struck through as well as greyed, so the state never rests
 * on colour alone.
 */
function IngredientRow({
  checked,
  onToggle,
  name,
  amount,
}: {
  checked: boolean
  onToggle: () => void
  name: string | undefined
  amount: string | null
}) {
  const text = checked ? 'text-ink-muted line-through' : 'text-ink'
  return (
    <label className="flex min-h-[56px] cursor-pointer items-center gap-3.5 border-b-[1.5px] border-border-card px-1 py-1.5">
      <span className="relative flex h-8 w-8 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="peer h-8 w-8 cursor-pointer appearance-none rounded-lg border-[2.5px] border-field bg-white checked:border-success checked:bg-success"
        />
        <Check
          aria-hidden="true"
          size={22}
          strokeWidth={3.5}
          className="pointer-events-none absolute inset-0 m-auto hidden text-white peer-checked:block"
        />
      </span>
      <span className={`text-scalable min-w-0 flex-1 break-words leading-snug ${text}`}>{name}</span>
      {/* Wraps (right-aligned) rather than nowrap: a long amount such as
          "1 i 1/2 szklanki (ok. 375 ml)" at A++ would scroll the page sideways. */}
      {amount && <b className={`text-scalable max-w-[45%] text-right ${text}`}>{amount}</b>}
    </label>
  )
}

/**
 * Składniki + Przygotowanie for the recipe page (E01-S07, S07b): ingredient ticks are
 * kept per tab in sessionStorage; steps are plain text under "Krok N" (handoff C3,
 * item 9 — ticking is for ingredients; owner decision 2026-10-20: the total, „z M”,
 * only in cooking mode, where one step shows at a time); "Wielkość tekstu" scales both lists.
 * "Tryb gotowania" (E01-S08) follows "Wielkość tekstu", as in the design handoff (C3, item 7).
 * From lg (E01-S17, A9) a `1fr 1.6fr` grid: the ingredients in a panel | the steps
 * plus `children`. Below lg it is one column, in the same order.
 */
export function RecipeChecklists({
  recipeId,
  title,
  ingredientGroups,
  steps,
  stepImages = [],
  servings,
  children,
}: RecipeChecklistsProps) {
  const { level, setLevel } = useTextScale()
  const [raw, setRaw] = useSessionStorage(checklistStorageKey(recipeId))
  const state = useMemo(() => parseChecklist(raw), [raw])

  // „Zdjęcia kroków: Pokaż / Ukryj” (ZMIANY §3): only when some step has a photo.
  // The choice is remembered globally; default „Pokaż”. localStorage is read after
  // mount (a lazy initializer would mismatch the server HTML); a private window keeps
  // the default.
  const showToggle = stepImages.some(Boolean)
  const [showPhotos, setShowPhotos] = useState(true)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STEP_PHOTOS_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored !== null) setShowPhotos(stored === '1')
    } catch {
      // storage blocked — keep the default „Pokaż”
    }
  }, [])
  function pickPhotos(show: boolean) {
    setShowPhotos(show)
    try {
      window.localStorage.setItem(STEP_PHOTOS_KEY, show ? '1' : '0')
    } catch {
      // ignore
    }
  }

  // „Ukryj” drops the photos everywhere (the list, the viewer, cooking mode) in one
  // place. Tapping a photo opens the shared viewer captioned „Krok N”, so a photo
  // shared with the gallery still says which step it belongs to.
  const visibleStepImages = showPhotos ? stepImages : NO_STEP_IMAGES
  const stepPhotos = useMemo(
    () =>
      steps.flatMap((_, i) =>
        visibleStepImages[i]
          ? [{ step: i, src: visibleStepImages[i], caption: `Krok ${i + 1}`, alt: `Zdjęcie do kroku ${i + 1}` }]
          : [],
      ),
    [steps, visibleStepImages],
  )
  const [photoIndex, setPhotoIndex] = useState<number | null>(null)

  const toggle = (index: number) => setRaw(JSON.stringify(toggleChecked(state, 'ingredients', index)))

  // Ingredients are numbered flat across sections: each group's first index.
  const offsets = useMemo(
    () => ingredientGroups.map((_, gi) => ingredientGroups.slice(0, gi).reduce((n, g) => n + g.items.length, 0)),
    [ingredientGroups],
  )

  return (
    <div className="lg:grid lg:grid-cols-[1fr_1.6fr] lg:items-start lg:gap-x-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
        <TextSizeControls level={level} onChange={setLevel} />
        {state.ingredients.length > 0 && (
          <button
            type="button"
            onClick={() => setRaw(null)}
            className="min-h-[48px] px-1 text-[17px] font-bold text-action-text underline hover:text-action-hover"
          >
            Wyczyść zaznaczenia
          </button>
        )}
      </div>

      {steps.length > 0 && (
        <div className="mb-8 lg:col-span-2">
          <CookingMode title={title} steps={steps} stepImages={visibleStepImages} />
        </div>
      )}

      <section
        aria-labelledby="ingredients-heading"
        className="mb-10 lg:rounded-card lg:border lg:border-border-card lg:bg-surface-2 lg:p-6"
      >
        {/* C3, item 8: "Składniki" with "na 4 porcje" on the same baseline, only when
            the source states the servings. */}
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
          {/* min-w-0: a flex item never shrinks below its longest word otherwise (WCAG 1.4.10). */}
          <h2 id="ingredients-heading" className="min-w-0 text-[24px] font-bold text-ink">
            Składniki
          </h2>
          {servings != null && <p className="min-w-0 text-[16px] text-ink-soft">{servingsLabel(servings)}</p>}
        </div>
        {ingredientGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
            {group.section && <h3 className="mb-1 text-[17px] font-bold text-ink-soft">{group.section}</h3>}
            {/* 19 px on the parent: .text-scalable (unlayered) scales its parent's size
                and would override a size utility on the same element. */}
            <ul className="text-[19px]">
              {group.items.map((ingredient, ii) => {
                const index = offsets[gi] + ii
                return (
                  <li key={index}>
                    <IngredientRow
                      checked={state.ingredients.includes(index)}
                      onToggle={() => toggle(index)}
                      name={ingredient.name}
                      amount={ingredient.amount ? [ingredient.amount, ingredient.unit].filter(Boolean).join(' ') : null}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      <div>
        <section aria-labelledby="steps-heading" className="mb-10">
          {/* The toggle sits beside the heading and wraps under it at 320 px (ZMIANY §3). */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 id="steps-heading" className="text-[24px] font-bold text-ink">
              Przygotowanie
            </h2>
            {showToggle && (
              <div role="group" aria-label="Zdjęcia kroków" className="flex items-center gap-2.5">
                <span className="text-[17px] font-bold text-ink">Zdjęcia kroków</span>
                {/* One shared 2 px frame; the two buttons are glued, selected = dark fill. */}
                <div className="flex overflow-hidden rounded-xl border-2 border-border-dark">
                  {PHOTO_OPTIONS.map(([label, show]) => {
                    const active = showPhotos === show
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => pickPhotos(show)}
                        className={`min-h-12 min-w-[88px] px-3 text-[17px] font-bold ${
                          active ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-surface-3'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          {steps.length === 0 ? (
            <p className="text-[19px] text-ink-soft">Brak kroków przygotowania.</p>
          ) : (
            <ol className="space-y-5">
              {steps.map((step, i) => (
                <li key={i} className="text-[19px]">
                  <p className="mb-1.5 text-[17px] font-bold text-action-text">
                    Krok {i + 1}
                  </p>
                  <p className="text-scalable leading-[1.6] text-ink">{step}</p>
                  {/* Source photo under the step text, same <li>; 4:3, no layout jump (ZMIANY §2).
                      A tap opens the full-screen viewer, like a gallery photo. */}
                  {visibleStepImages[i] && (
                    <figure className="mt-1.5 max-w-full md:max-w-[520px]">
                      <button
                        type="button"
                        onClick={() => setPhotoIndex(stepPhotos.findIndex((p) => p.step === i))}
                        aria-label={`Powiększ zdjęcie do kroku ${i + 1}`}
                        className="relative block aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-surface-3 md:rounded-xl"
                      >
                        <Image
                          src={visibleStepImages[i]}
                          alt={`Zdjęcie do kroku ${i + 1}`}
                          fill
                          sizes="(min-width: 768px) 520px, 100vw"
                          loading="lazy"
                          className="object-cover transition-transform hover:scale-105"
                          unoptimized={!isArchivedImageUrl(visibleStepImages[i])}
                        />
                      </button>
                    </figure>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
        {children}
      </div>

      {stepPhotos.length > 0 && (
        <ImageLightbox label="Podgląd zdjęcia kroku" items={stepPhotos} index={photoIndex} onIndex={setPhotoIndex} />
      )}
    </div>
  )
}
