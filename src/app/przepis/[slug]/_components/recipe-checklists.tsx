'use client'

import { useMemo } from 'react'
import { TextSizeControls } from '@/app/components/ui/text-size-controls'
import { useTextScale } from '@/app/components/ui/use-text-scale'
import { useSessionStorage } from '@/app/components/ui/use-session-storage'
import {
  checklistStorageKey,
  hasChecked,
  parseChecklist,
  toggleChecked,
  type ChecklistKind,
} from '@/lib/recipe-checklist'
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
}

/**
 * One checkbox row: a native input (32 px box) inside its label, so the whole
 * ≥ 48 px row is the target. A ticked row is struck through as well as greyed, so
 * the state never rests on colour alone.
 */
function CheckRow({
  checked,
  onToggle,
  describedBy,
  children,
}: {
  checked: boolean
  onToggle: () => void
  /** id of a visible label to announce with the row ("Krok N z M"). */
  describedBy?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex min-h-[48px] cursor-pointer items-start gap-3 py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-describedby={describedBy}
        className="mt-0.5 h-8 w-8 shrink-0 cursor-pointer accent-action"
      />
      <span className={checked ? 'text-ink-soft line-through' : 'text-ink'}>{children}</span>
    </label>
  )
}

/**
 * Składniki + Przygotowanie for the recipe page (E01-S07): ticks are kept per tab in
 * sessionStorage, steps read "Krok N z M", and "Wielkość tekstu" scales both lists.
 * "Tryb gotowania" (E01-S08) follows "Wielkość tekstu", as in the design handoff (C3, item 7).
 */
export function RecipeChecklists({ recipeId, title, ingredientGroups, steps }: RecipeChecklistsProps) {
  const { level, setLevel, scaleStyle } = useTextScale()
  const [raw, setRaw] = useSessionStorage(checklistStorageKey(recipeId))
  const state = useMemo(() => parseChecklist(raw), [raw])

  const toggle = (kind: ChecklistKind, index: number) => setRaw(JSON.stringify(toggleChecked(state, kind, index)))

  // Ingredients are numbered flat across sections: each group's first index.
  const offsets = useMemo(
    () => ingredientGroups.map((_, gi) => ingredientGroups.slice(0, gi).reduce((n, g) => n + g.items.length, 0)),
    [ingredientGroups],
  )

  return (
    <div style={scaleStyle}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <TextSizeControls level={level} onChange={setLevel} />
        {hasChecked(state) && (
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
        <div className="mb-8">
          <CookingMode title={title} steps={steps} />
        </div>
      )}

      <section aria-labelledby="ingredients-heading" className="mb-10">
        <h2 id="ingredients-heading" className="mb-3 text-[26px] font-bold text-ink">
          Składniki
        </h2>
        {ingredientGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
            {group.section && <h3 className="mb-1 text-[17px] font-bold text-ink-soft">{group.section}</h3>}
            <ul className="text-scalable text-[19px]">
              {group.items.map((ingredient, ii) => {
                const index = offsets[gi] + ii
                return (
                  <li key={index}>
                    <CheckRow
                      checked={state.ingredients.includes(index)}
                      onToggle={() => toggle('ingredients', index)}
                    >
                      {ingredient.name}
                      {ingredient.amount && (
                        <>
                          {' — '}
                          {ingredient.amount}
                          {ingredient.unit && ` ${ingredient.unit}`}
                        </>
                      )}
                    </CheckRow>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="steps-heading" className="mb-10">
        <h2 id="steps-heading" className="mb-3 text-[26px] font-bold text-ink">
          Przygotowanie
        </h2>
        {steps.length === 0 ? (
          <p className="text-[19px] text-ink-soft">Brak kroków przygotowania.</p>
        ) : (
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i}>
                <p id={`step-${i}-label`} className="text-[16px] font-bold text-ink-soft">
                  Krok {i + 1} z {steps.length}
                </p>
                <div className="text-scalable text-[19px]">
                  <CheckRow
                    checked={state.steps.includes(i)}
                    onToggle={() => toggle('steps', i)}
                    describedBy={`step-${i}-label`}
                  >
                    {step}
                  </CheckRow>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
