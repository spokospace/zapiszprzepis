/**
 * Duration in a recipe step, for the in-page timer (#611, Phase 1). Pure: the step text in,
 * the timer's length out. Number words ("pięć minut") are not matched, so they get no timer.
 */
export type StepDuration = { min: number; addMin: 1 | 3 | 5 }

const RANGE = /(\d+)\s*[–-]\s*(\d+)\s*(?:minut\w*|min\b)/i
const MINUTES = /(\d+)\s*(?:minut\w*|min\b)/i
const HOURS = /(\d+)\s*(?:godz\.?|godzin\w*)/i

/** The "+N min" step closest to the range's width, so the button adds a sensible extra. */
function nearestAddMin(width: number): 1 | 3 | 5 {
  if (width <= 2) return 1
  if (width <= 4) return 3
  return 5
}

export function parseStepDuration(text: string): StepDuration | null {
  const range = RANGE.exec(text)
  if (range) {
    const low = Number(range[1])
    const high = Number(range[2])
    if (low <= 0 || high < low) return null
    return { min: low, addMin: nearestAddMin(high - low) }
  }

  const minutes = MINUTES.exec(text)
  if (minutes) {
    const min = Number(minutes[1])
    return min > 0 ? { min, addMin: 5 } : null
  }

  const hours = HOURS.exec(text)
  if (hours) {
    const min = Number(hours[1]) * 60
    return min > 0 ? { min, addMin: 5 } : null
  }

  return null
}
