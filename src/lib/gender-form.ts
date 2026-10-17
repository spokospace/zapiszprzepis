import { recipesNoun } from '@/app/components/app-menu-model'

/**
 * The grammatical form for gendered Polish wording (E01-S23): 'f' → "Dodała",
 * 'm' → "Dodał", null → neutral wording. Public surfaces only ever receive this
 * form (public_recipes.author_gender_form, profile_gender_form()), never the raw
 * gender, which stays owner-only in profiles_private (E01-S12).
 */
export type GenderForm = 'f' | 'm'

/** A value from the DB/RPC → a form, or null for anything else (missing column, unknown, not chosen). */
export function parseGenderForm(raw: unknown): GenderForm | null {
  return raw === 'f' || raw === 'm' ? raw : null
}

/** The owner's own stored gender (profiles_private.gender) → a form. */
export function genderFormOf(gender: unknown): GenderForm | null {
  if (gender === 'female') return 'f'
  if (gender === 'male') return 'm'
  return null
}

/** Third-person past "Dodała" / "Dodał"; null when the form is unknown (callers pick neutral wording). */
export function addedVerb(form: GenderForm | null): string | null {
  if (form === 'f') return 'Dodała'
  if (form === 'm') return 'Dodał'
  return null
}

/** Second-person past "Dodałaś" / "Dodałeś" (talking to the signed-in user); null when unknown. */
export function addedVerbYou(form: GenderForm | null): string | null {
  if (form === 'f') return 'Dodałaś'
  if (form === 'm') return 'Dodałeś'
  return null
}

/** What precedes the author's name on a recipe: "Dodała" / "Dodał" / neutral "Dodane przez". */
export function authorLinePrefix(form: GenderForm | null): string {
  return addedVerb(form) ?? 'Dodane przez'
}

/** Public profile header: "Dodała 5 przepisów" / neutral "Dodane przepisy: 5". */
export function profileCountLine(form: GenderForm | null, count: number): string {
  const verb = addedVerb(form)
  return verb ? `${verb} ${count} ${recipesNoun(count)}` : `Dodane przepisy: ${count}`
}

/** Public profile without recipes: "Ania nie dodała jeszcze przepisów." / neutral sentence. */
export function profileEmptyText(form: GenderForm | null, name: string): string {
  const verb = addedVerb(form)
  return verb ? `${name} nie ${verb.toLowerCase()} jeszcze przepisów.` : 'Na tym profilu nie ma jeszcze przepisów.'
}

/** Settings preview (2a): "Dodałaś 3 przepisy." — null when the form is unknown or nothing was added yet. */
export function youAddedLine(form: GenderForm | null, count: number): string | null {
  const verb = addedVerbYou(form)
  return verb && count > 0 ? `${verb} ${count} ${recipesNoun(count)}.` : null
}
