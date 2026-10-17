// Pure step navigation for cooking mode (E01-S08): one step at a time,
// "Krok N z M" and a segmented progress bar.

/** Above this many steps the bar is one continuous fill (segments would get too thin on a 320 px phone). */
export const MAX_PROGRESS_SEGMENTS = 20

/** Keep a 0-based step index inside [0, total - 1]; 0 for an empty or garbage input. */
export function clampStep(index: number, total: number): number {
  if (!Number.isFinite(index) || total <= 0) return 0
  return Math.min(Math.max(Math.trunc(index), 0), total - 1)
}

/** "Krok N z M" for a 0-based index. */
export function stepLabel(index: number, total: number): string {
  return `Krok ${clampStep(index, total) + 1} z ${Math.max(total, 1)}`
}

export function isLastStep(index: number, total: number): boolean {
  return total <= 0 || clampStep(index, total) === total - 1
}

export type SegmentState = 'done' | 'current' | 'todo'

/**
 * The progress bar for a 0-based index: one state per step, or `null` when
 * there are too many steps for segments and the bar should be a single fill
 * (use `progressRatio`).
 */
export function progressSegments(index: number, total: number): SegmentState[] | null {
  if (total > MAX_PROGRESS_SEGMENTS) return null
  const current = clampStep(index, total)
  return Array.from({ length: total }, (_, i) => (i < current ? 'done' : i === current ? 'current' : 'todo'))
}

/** Share of the recipe reached at a 0-based index, counting the current step: 1 of 4 → 0.25. */
export function progressRatio(index: number, total: number): number {
  if (total <= 0) return 0
  return (clampStep(index, total) + 1) / total
}
