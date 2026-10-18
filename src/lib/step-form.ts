// The form of a recipe's steps: impersonal instructions led by an infinitive
// ("Pokroić mięso w kostkę."), never the author's narration ("pokroiłam").
// STEP_FORM_RULE is shared by the extraction prompt, which writes new recipes'
// steps, and the rewrite of steps saved before the rule existed
// (scripts/rewrite-recipe-steps.ts), so the two cannot drift.
import { postChatJson, type LabelRecipeDeps } from '@/lib/recipe-labeling'

export const STEP_FORM_RULE = `Steps are short, plain instructions in Polish, not prose: start each with a verb in the infinitive saying what to do ("Pokroić mięso w kostkę.", "Zeszklić cebulę.", "Dodać śmietanę i gotować 10 minut."). Rewrite the author's narration ("pokroiłam", "zeszkliłam", "dodałem", "gotujemy") and commands ("pokrój", "dodaj") into this form. Drop first-person asides ("u mnie", "ja użyłam") and words that only mean "next" ("Następnie", "Potem", "Teraz", "Na koniec") — the steps are numbered; keep words that say when ("W międzyczasie", "Gdy woda się zagotuje", "Po 20 minutach"). Keep every amount, time, temperature and detail the source gives, in its order — do not drop, merge or add steps.`

export const STEP_REWRITE_PROMPT = `You fix the grammar of a saved Polish recipe's steps. Return ONLY JSON: {"steps": [...]} — exactly as many steps as given, in the same order, one rewritten step for each.
- ${STEP_FORM_RULE}
- A step already in this form stays word for word.`

// Narration: a past form after a vowel ("dodała|m", "zrobiłe|m" — but not
// "masłem"), a plural past ("dodaliśmy"), or a present "we" form ("gotujemy").
const NARRATION = /^(?:\p{L}*[aeiouyąęó]ł(?:am|em)|\p{L}+(?:liśmy|łyśmy)|\p{L}{3,}(?:amy|emy|imy|ymy))$/u
// How far into a step its instruction verb may sit ("Na patelni rozgrzać…").
const LEADING_WORDS = 6

/** An infinitive: "-ć" ("dodać", but not the noun "ilość") or the "piec" family ("upiec"). */
function isInfinitive(word: string): boolean {
  return (word.endsWith('ć') && !word.endsWith('ość')) || word.endsWith('piec')
}

function words(step: string): string[] {
  return step.toLocaleLowerCase('pl').match(/\p{L}+/gu) ?? []
}

/** A step that reads as an instruction: an infinitive near its start, no narration anywhere. */
export function isInstructionStep(step: string): boolean {
  const all = words(step)
  return all.slice(0, LEADING_WORDS).some(isInfinitive) && !all.some((w) => NARRATION.test(w))
}

/**
 * Whether a recipe's steps are worth sending to the rewrite: any step that
 * doesn't read as an instruction. A false positive costs one call whose answer
 * comes back unchanged; a miss leaves a recipe as it was.
 */
export function needsStepRewrite(steps: string[]): boolean {
  return steps.some((step) => !isInstructionStep(step))
}

function numbers(step: string): string {
  return (step.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')).sort().join(' ')
}

/**
 * The rewritten steps, or null when the answer may have changed the method:
 * a different number of steps (the step checklist is indexed by position), an
 * empty or non-text step, or a step whose numbers — amounts, times,
 * temperatures — differ from the original's.
 */
export function acceptRewrite(original: string[], raw: unknown): string[] | null {
  const steps = (raw as { steps?: unknown } | null)?.steps
  if (!Array.isArray(steps) || steps.length !== original.length) return null
  if (!steps.every((s): s is string => typeof s === 'string' && s.trim().length > 0)) return null
  const rewritten = steps.map((s) => s.trim())
  return rewritten.every((s, i) => numbers(s) === numbers(original[i])) ? rewritten : null
}

/** Steps rewritten into the instruction form, or null when the answer fails acceptRewrite. Throws on an OpenAI error. */
export async function rewriteSteps(steps: string[], deps: LabelRecipeDeps): Promise<string[] | null> {
  const out = await postChatJson(
    [
      { role: 'system', content: STEP_REWRITE_PROMPT },
      { role: 'user', content: JSON.stringify({ steps }) },
    ],
    0,
    deps,
  )
  return acceptRewrite(steps, out)
}
