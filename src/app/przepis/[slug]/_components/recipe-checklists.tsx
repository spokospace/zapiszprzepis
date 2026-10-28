'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { useSessionStorage } from '@/app/components/ui/use-session-storage'
import { checklistStorageKey, parseChecklist, toggleChecked } from '@/lib/recipe-checklist'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { servingsLabel } from '@/lib/servings'
import { stepsLabel } from '@/lib/recipe-meta'
import { ImageLightbox } from '@/app/components/image-lightbox'
import { householdMeasure, type Ingredient } from '@/lib/ingredients'
import { useStepPhotos } from './use-step-photos'
import { RECIPE_SPLIT } from './recipe-split'

/** „Pokaż” / „Ukryj” — the two states of the step-photos toggle (ZMIANY §3). */
const PHOTO_OPTIONS: [label: string, show: boolean][] = [
  ['Pokaż', true],
  ['Ukryj', false],
]
/** Stable empty list so „Ukryj” hides photos without a fresh array every render. */
const NO_STEP_IMAGES: string[] = []

interface IngredientGroup {
  section: string | null
  items: Ingredient[]
}

interface RecipeChecklistsProps {
  recipeId: number
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
  alt,
}: {
  checked: boolean
  onToggle: () => void
  name: string | undefined
  amount: string | null
  /** Household measure shown under the amount ("ok. 1,5 szklanki"), or null (#505). */
  alt: string | null
}) {
  const text = checked ? 'text-ink-muted line-through' : 'text-ink'
  const altText = checked ? text : 'text-ink-soft'
  return (
    <label className="flex min-h-[56px] cursor-pointer flex-wrap items-center gap-3.5 border-b-[1.5px] border-border-card px-1 py-1.5 max-[359px]:gap-y-1">
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
      {/* The spaces between the name, the amount and the alt measure are for text
          extraction, not layout (a flex container drops whitespace-only text): without
          them Google's ingredient snippet read "Mąka pszenna500 gok. 3 3/4 szklanki". */}{' '}
      {/* Both wrap (right-aligned) rather than nowrap: a long amount or measure at
          A++ would scroll the page sideways. With an alt measure the metric amount
          sits on top and the household measure below it, lighter and 16 px — the
          owner's "second line" treatment (#505). */}
      {alt ? (
        <span className="flex max-w-[45%] flex-col items-end text-right max-[359px]:max-w-none max-[359px]:basis-full max-[359px]:items-start max-[359px]:pl-[46px] max-[359px]:text-left">
          {amount && <b className={`text-scalable ${text}`}>{amount}</b>}{' '}
          {/* 16 px base so .text-scalable (which scales the parent em) grows from 16, not 19. */}
          <span className="text-[16px]">
            <span className={`text-scalable ${altText}`}>{alt}</span>
          </span>
        </span>
      ) : (
        amount && (
          <b className={`text-scalable max-w-[45%] text-right max-[359px]:max-w-none max-[359px]:basis-full max-[359px]:pl-[46px] max-[359px]:text-left ${text}`}>
            {amount}
          </b>
        )
      )}
    </label>
  )
}

/**
 * Progress through the steps: how many ticked steps still match a step (a stale tick from
 * an older version of the recipe cannot push the count past the total), and the first step
 * still open, or -1 when every step is done.
 */
export function stepProgress(total: number, ticked: number[]): { done: number; next: number } {
  const open = Array.from({ length: total }, (_, i) => i).filter((i) => !ticked.includes(i))
  return { done: total - open.length, next: open[0] ?? -1 }
}

type Checklist = ReturnType<typeof parseChecklist>

/**
 * The progress line over the steps (handoff 2026-10-28): before the first tick it says
 * how to tick ("9 kroków · kliknij numer, gdy skończysz krok"), then counts. A one-step
 * recipe gets its own words once ticked: "1 z 1 kroków" is not Polish.
 */
export function stepProgressLabel(done: number, total: number): string {
  if (done === 0) return `${stepsLabel(total)} · kliknij numer, gdy skończysz krok`
  if (total === 1) return 'Krok zrobiony'
  return `${done} z ${total} kroków zrobione`
}

/** The stored checklist after ticking or unticking step `index`. */
export function toggledStepRaw(state: Checklist, index: number): string {
  return JSON.stringify(toggleChecked(state, 'steps', index))
}

/**
 * The stored checklist after "Wyczyść zaznaczenia". The button sits in the ingredients
 * card, so it clears the ingredient ticks only; with no step ticks left the key goes.
 */
export function ingredientsResetRaw(state: Checklist): string | null {
  return state.steps.length === 0 ? null : JSON.stringify({ ...state, ingredients: [] })
}

/**
 * Składniki + Przygotowanie for the recipe page (E01-S07, S07b): ingredient and step
 * ticks are kept per tab in sessionStorage and never sent to the server. Each step has a
 * numbered button (handoff 2026-10-28): ticked steps are struck through, the first open
 * step after a tick carries "Teraz", and a progress line counts them. The "z M" total
 * stays in cooking mode only. Składniki and Przygotowanie keep scaling with the per-device
 * text size (`.text-scalable`, applied app-wide by TextScaleApplier); the A / A+ / A++
 * control lives on /wyswietlanie (FR #485). "Zacznij gotować" (E01-S08) opens above the
 * two lists. From lg (E01-S17, A9) a `1fr 1.6fr` grid: the ingredients in a panel | the
 * steps plus `children`. Below lg it is one column, in the same order.
 */
export function RecipeChecklists({
  recipeId,
  ingredientGroups,
  steps,
  stepImages = [],
  servings,
  children,
}: RecipeChecklistsProps) {
  const [raw, setRaw] = useSessionStorage(checklistStorageKey(recipeId))
  const state = useMemo(() => parseChecklist(raw), [raw])

  // „Zdjęcia kroków: Pokaż / Ukryj” (ZMIANY §3): only when some step has a photo. The
  // toggle state is shared (StepPhotosProvider) with „Zacznij gotować”, now in the action
  // row far above the steps, so „Ukryj” still hides photos there too.
  const showToggle = stepImages.some(Boolean)
  const { showPhotos, setShowPhotos } = useStepPhotos()

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
  const toggleStep = (index: number) => setRaw(toggledStepRaw(state, index))
  const { done: doneSteps, next: nextStep } = stepProgress(steps.length, state.steps)

  // Ingredients are numbered flat across sections: each group's first index.
  const offsets = useMemo(
    () => ingredientGroups.map((_, gi) => ingredientGroups.slice(0, gi).reduce((n, g) => n + g.items.length, 0)),
    [ingredientGroups],
  )

  return (
    // A hairline above, 40 px over the two lists (handoff 2026-10-28 §4); not on paper.
    <div className={`recipe-print-grid border-t border-border-card pt-10 print:border-0 print:pt-0 ${RECIPE_SPLIT}`}>
      <section
        aria-labelledby="ingredients-heading"
        className="mb-10 lg:rounded-tile lg:border lg:border-border-card lg:bg-surface-2 lg:p-6"
      >
        {/* C3, item 8: "Składniki" with "na 4 porcje" on the same baseline, only when
            the source states the servings. */}
        <div className="mb-3 flex items-baseline justify-between gap-x-3">
          {/* The reset stays on the heading's line: the heading never shrinks, so it cannot
              break mid-word (WCAG 1.4.10), and the reset gives up width and wraps its own
              text instead. The servings label wraps under the heading. */}
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
            <h2 id="ingredients-heading" className="shrink-0 text-[24px] font-bold text-ink">
              Składniki
            </h2>
            {servings != null && <p className="min-w-0 text-[16px] text-ink-soft">{servingsLabel(servings)}</p>}
          </div>
          {/* Always mounted, so ticking an ingredient moves nothing on the page. `invisible`
              keeps the space and takes the reset out of the tab order and the accessibility
              tree while nothing is ticked. */}
          <button
            type="button"
            onClick={() => setRaw(ingredientsResetRaw(state))}
            className={`min-h-[48px] min-w-0 px-1 text-right text-[17px] font-bold text-action-text underline hover:text-action-hover print:hidden${
              state.ingredients.length === 0 ? ' invisible' : ''
            }`}
          >
            Wyczyść zaznaczenia
          </button>
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
                      alt={householdMeasure(ingredient)}
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
          {/* The toggle sits beside the heading and wraps under it at 320 px (ZMIANY §3).
              min-w-0, like „Składniki”: at a large system font the word outgrew a phone (#448). */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 id="steps-heading" className="min-w-0 text-[24px] font-bold text-ink">
              Przygotowanie
            </h2>
            {showToggle && (
              <div role="group" aria-label="Zdjęcia kroków" className="flex items-center gap-2.5 print:hidden">
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
                        onClick={() => setShowPhotos(show)}
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
            <>
              {/* The count is also the progress bar's accessible value; the bar itself is
                  decorative and hidden from assistive tech. */}
              <div className="mb-5 print:hidden">
                <p className="mb-2 text-[16px] text-ink-soft">
                  {stepProgressLabel(doneSteps, steps.length)}
                </p>
                <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-pill bg-surface-3">
                  <div className="h-full bg-success" style={{ width: `${(doneSteps / steps.length) * 100}%` }} />
                </div>
              </div>
              <ol className="space-y-5">
                {steps.map((step, i) => {
                  const done = state.steps.includes(i)
                  return (
                    <li key={i} className="flex gap-4 text-[19px] print:block">
                      {/* The number is the button (handoff 2026-10-28): 48 px, outlined when open,
                          filled with a ✓ when done. Hidden on paper, where the plain list prints. */}
                      <button
                        type="button"
                        aria-pressed={done}
                        aria-label={`Krok ${i + 1} — ${done ? 'zrobiony, cofnij' : 'oznacz jako zrobiony'}`}
                        onClick={() => toggleStep(i)}
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-pill border-2 print:hidden ${
                          done ? 'border-success bg-success text-white' : 'border-action bg-white text-action-text hover:bg-surface-3'
                        }`}
                      >
                        {done ? (
                          <Check aria-hidden="true" size={22} strokeWidth={3.5} />
                        ) : (
                          <span aria-hidden="true" className="text-[18px] font-bold">
                            {i + 1}
                          </span>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px] font-bold text-action-text">
                          <span className={done ? 'text-ink-soft' : undefined}>Krok {i + 1}</span>
                          {i === nextStep && doneSteps > 0 && (
                            <span className="rounded-md bg-action px-2 py-0.5 text-[14px] font-bold text-white print:hidden">
                              Teraz
                            </span>
                          )}
                          {done && <span className="text-[15px] font-bold text-success print:hidden">zrobiony</span>}
                        </p>
                        <p className={`text-scalable leading-[1.6] ${done ? 'text-ink-muted line-through' : 'text-ink'}`}>{step}</p>
                        {/* Source photo under the step text, same <li>; 4:3, no layout jump (ZMIANY §2).
                            A tap opens the full-screen viewer, like a gallery photo. */}
                        {visibleStepImages[i] && (
                          <figure className="mt-1.5 max-w-full md:max-w-[520px] print:hidden">
                            <button
                              type="button"
                              onClick={() => setPhotoIndex(stepPhotos.findIndex((p) => p.step === i))}
                              aria-label={`Powiększ zdjęcie do kroku ${i + 1}`}
                              className="relative block aspect-[4/3] w-full overflow-hidden rounded-tile bg-surface-3"
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
                      </div>
                    </li>
                  )
                })}
              </ol>
              {doneSteps === steps.length && (
                <p role="status" className="mt-6 rounded-tile bg-[#ecfdf3] p-4 text-[19px] font-bold text-[#14532d]">
                  Gotowe! Smacznego.
                </p>
              )}
            </>
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
