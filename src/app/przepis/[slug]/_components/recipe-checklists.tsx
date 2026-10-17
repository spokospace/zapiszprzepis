'use client'

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { TextSizeControls } from '@/app/components/ui/text-size-controls'
import { useTextScale } from '@/app/components/ui/use-text-scale'
import { useSessionStorage } from '@/app/components/ui/use-session-storage'
import { checklistStorageKey, parseChecklist, toggleChecked } from '@/lib/recipe-checklist'
import type { Ingredient } from '@/lib/ingredients'
import { CookingMode } from './cooking-mode'

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
 * kept per tab in sessionStorage; steps are plain text under "Krok N z M" (handoff C3,
 * item 9 — ticking is for ingredients); "Wielkość tekstu" scales both lists.
 * "Tryb gotowania" (E01-S08) follows "Wielkość tekstu", as in the design handoff (C3, item 7).
 * From lg (E01-S17, A9) a `1fr 1.6fr` grid: the ingredients in a panel | the steps
 * plus `children`. Below lg it is one column, in the same order.
 */
export function RecipeChecklists({ recipeId, title, ingredientGroups, steps, children }: RecipeChecklistsProps) {
  const { level, setLevel, scaleStyle } = useTextScale()
  const [raw, setRaw] = useSessionStorage(checklistStorageKey(recipeId))
  const state = useMemo(() => parseChecklist(raw), [raw])

  const toggle = (index: number) => setRaw(JSON.stringify(toggleChecked(state, 'ingredients', index)))

  // Ingredients are numbered flat across sections: each group's first index.
  const offsets = useMemo(
    () => ingredientGroups.map((_, gi) => ingredientGroups.slice(0, gi).reduce((n, g) => n + g.items.length, 0)),
    [ingredientGroups],
  )

  return (
    <div style={scaleStyle} className="lg:grid lg:grid-cols-[1fr_1.6fr] lg:items-start lg:gap-x-12">
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
          <CookingMode title={title} steps={steps} />
        </div>
      )}

      <section
        aria-labelledby="ingredients-heading"
        className="mb-10 lg:rounded-card lg:border lg:border-border-card lg:bg-surface-2 lg:p-6"
      >
        <h2 id="ingredients-heading" className="mb-3 text-[26px] font-bold text-ink">
          Składniki
        </h2>
        {/* "na N porcji" (handoff C3, item 8) waits for a servings field: recipes store none yet. */}
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
          <h2 id="steps-heading" className="mb-3 text-[26px] font-bold text-ink">
            Przygotowanie
          </h2>
          {steps.length === 0 ? (
            <p className="text-[19px] text-ink-soft">Brak kroków przygotowania.</p>
          ) : (
            <ol className="space-y-5">
              {steps.map((step, i) => (
                <li key={i} className="text-[19px]">
                  <p className="mb-1.5 text-[17px] font-bold text-action-text">
                    Krok {i + 1} z {steps.length}
                  </p>
                  <p className="text-scalable leading-[1.6] text-ink">{step}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
        {children}
      </div>
    </div>
  )
}
