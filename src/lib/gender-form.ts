import { recipesNoun } from '@/app/components/app-menu-model'

/**
 * The grammatical form for gendered Polish wording the user sees about
 * themselves (E01-S23): 'f' → "Dodałaś", 'm' → "Dodałeś", null → neutral.
 * Never used for what others see: public pages are always neutral (#376).
 */
export type GenderForm = 'f' | 'm'

/** The owner's own stored gender (profiles_private.gender) → a form. */
export function genderFormOf(gender: unknown): GenderForm | null {
  if (gender === 'female') return 'f'
  if (gender === 'male') return 'm'
  return null
}

/** Second-person past "Dodałaś" / "Dodałeś" (talking to the signed-in user); null when unknown. */
export function addedVerbYou(form: GenderForm | null): string | null {
  if (form === 'f') return 'Dodałaś'
  if (form === 'm') return 'Dodałeś'
  return null
}

/** Settings preview (2a): "Dodałaś 3 przepisy." — null when the form is unknown or nothing was added yet. */
export function youAddedLine(form: GenderForm | null, count: number): string | null {
  const verb = addedVerbYou(form)
  return verb && count > 0 ? `${verb} ${count} ${recipesNoun(count)}.` : null
}
