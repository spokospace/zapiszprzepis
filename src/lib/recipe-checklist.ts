/**
 * Ticked ingredients and steps on the recipe page (E01-S07). Personal and per tab:
 * the state lives in sessionStorage only and is never sent to the server.
 * Ingredients are indexed flat across their sections; steps by position.
 */
export type ChecklistKind = 'ingredients' | 'steps'
export type ChecklistState = Record<ChecklistKind, number[]>

export const EMPTY_CHECKLIST: ChecklistState = { ingredients: [], steps: [] }

export function checklistStorageKey(recipeId: number | string): string {
  return `zp-check:${recipeId}`
}

function indexes(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((n): n is number => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b)
}

/** Defensive read of the stored JSON: anything malformed means "nothing ticked". */
export function parseChecklist(raw: string | null): ChecklistState {
  if (!raw) return EMPTY_CHECKLIST
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return EMPTY_CHECKLIST
    const { ingredients, steps } = parsed as Record<string, unknown>
    return { ingredients: indexes(ingredients), steps: indexes(steps) }
  } catch {
    return EMPTY_CHECKLIST
  }
}

export function toggleChecked(state: ChecklistState, kind: ChecklistKind, index: number): ChecklistState {
  const current = state[kind]
  const next = current.includes(index)
    ? current.filter((i) => i !== index)
    : [...current, index].sort((a, b) => a - b)
  return { ...state, [kind]: next }
}

export function hasChecked(state: ChecklistState): boolean {
  return state.ingredients.length > 0 || state.steps.length > 0
}
