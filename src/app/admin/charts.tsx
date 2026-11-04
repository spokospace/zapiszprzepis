import type { DayValue } from '@/lib/staff/series'
import { formatCount, formatDay } from '@/lib/staff/usage'

// Charts for the admin statistics screens. Server-rendered SVG on the site's tokens,
// no chart library (the Worker bundle has a size limit) and no client JS: each bar
// carries a <title> for the hover value, and a table with the same numbers sits
// under every chart for screen readers and exact reading.

const shortDay = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function formatShortDay(value: string): string {
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? value : shortDay.format(d)
}

/**
 * The day labels under the chart, by index. `narrow`: first, middle and last, which fit
 * a phone. `wide` (from `sm`): every day of a short window, about six otherwise, the
 * last always kept and the one before it dropped when it would crowd it.
 */
export function axisDays(count: number): { narrow: number[]; wide: number[] } {
  const last = count - 1
  const narrow = [...new Set([0, Math.floor(last / 2), last])].filter((i) => i >= 0)
  if (count <= 8) return { narrow, wide: Array.from({ length: count }, (_, i) => i) }
  const step = Math.ceil(count / 6)
  const marks = Array.from({ length: count }, (_, i) => i).filter((i) => i % step === 0 && last - i >= step)
  return { narrow, wide: [...marks, last] }
}

/** One measure per day as vertical bars, with the total, the busiest day and a data table. */
export function DailyBars({ title, data, unit }: { title: string; data: DayValue[]; unit: string }) {
  if (data.length === 0) return null
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const max = Math.max(...data.map((d) => d.value))
  const peak = data.find((d) => d.value === max)!
  const width = 100 / data.length
  // A 2px-ish gap between bars at any width: a share of each slot, capped for long windows.
  const gap = Math.min(width * 0.25, 0.6)
  const summary =
    total === 0
      ? `${title}: brak w tym okresie.`
      : `${title}: razem ${formatCount(total)} ${unit}, najwięcej ${formatCount(max)} (${formatDay(peak.day)}).`
  const axis = axisDays(data.length)
  const narrow = new Set(axis.narrow)
  const wide = new Set(axis.wide)

  return (
    <figure className="mb-6">
      <figcaption className="mb-1 font-semibold">{title}</figcaption>
      <p className="mb-2 text-ink-soft">
        Razem {formatCount(total)}
        {total > 0 && `, najwięcej ${formatCount(max)} (${formatDay(peak.day)})`}
      </p>
      <div className="flex gap-2">
        {/* y scale: 0 at the baseline, the busiest day at the top gridline */}
        <div aria-hidden className="flex h-40 flex-col justify-between text-right text-base text-ink-soft tabular-nums">
          <span className="-mt-3">{formatCount(max)}</span>
          <span className="-mb-3">0</span>
        </div>
        <div className="min-w-0 flex-1">
          <svg
            role="img"
            aria-label={summary}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="block h-40 w-full overflow-visible"
          >
            <line x1="0" y1="0" x2="100" y2="0" className="stroke-border-card-2" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            {max > 0 &&
              data.map((d, i) => {
                const h = (d.value / max) * 100
                return (
                  <g key={d.day}>
                    {/* the full-height slot is the hover target, wider than a short bar */}
                    <rect x={i * width} y="0" width={width} height="100" fill="transparent">
                      <title>{`${formatDay(d.day)}: ${formatCount(d.value)}`}</title>
                    </rect>
                    {d.value > 0 && (
                      <rect x={i * width + gap / 2} y={100 - h} width={width - gap} height={h} className="fill-action" pointerEvents="none" />
                    )}
                  </g>
                )
              })}
            <line x1="0" y1="100" x2="100" y2="100" className="stroke-ink-muted" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <div aria-hidden className="relative mt-1 h-6 text-base text-ink-soft">
            {data.map((d, i) =>
              narrow.has(i) || wide.has(i) ? (
                <span
                  key={d.day}
                  className={['absolute top-0 whitespace-nowrap', !narrow.has(i) && 'hidden sm:inline', !wide.has(i) && 'sm:hidden']
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    i === data.length - 1
                      ? { right: 0 }
                      : i === 0
                        ? { left: 0 }
                        : { left: `${(i + 0.5) * width}%`, transform: 'translateX(-50%)' }
                  }
                >
                  {formatShortDay(d.day)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <details className="mt-2">
        <summary className="inline-flex min-h-touch cursor-pointer items-center underline underline-offset-4">
          Liczby dzień po dniu
        </summary>
        <table className="mt-2 w-full max-w-sm border-collapse text-left">
          <caption className="sr-only">{title}, dzień po dniu</caption>
          <thead>
            <tr className="border-b-2 border-border-card-2">
              <th scope="col" className="py-1 pr-4">Dzień</th>
              <th scope="col" className="py-1 text-right">Liczba</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-b border-border-card">
                <td className="py-1 pr-4">{formatDay(d.day)}</td>
                <td className="py-1 text-right tabular-nums">{formatCount(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/** A thin bar under a table row's label, its length relative to the largest row. Decorative: the number is in the row. */
export function ShareBar({ value, max }: { value: number; max: number }) {
  if (max <= 0 || value <= 0) return null
  return (
    <span aria-hidden className="mt-1 block h-1.5 rounded-full bg-action" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
  )
}
