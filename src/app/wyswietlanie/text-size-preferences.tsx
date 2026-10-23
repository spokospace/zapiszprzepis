'use client'

import { TextSizeControls } from '@/app/components/ui/text-size-controls'
import { useTextScale } from '@/app/components/ui/use-text-scale'

/**
 * The interactive island of /wyswietlanie: the A / A+ / A++ control wired to the
 * per-device store, an honest help line (the choice is saved on this device), and a
 * live preview — a mock ingredient row and a line of step text, both `.text-scalable`,
 * so tapping a level visibly resizes them in place. TextScaleApplier (root layout) owns
 * the actual `--text-scale` write, so the preview follows the same property the real
 * recipe pages do.
 */
export function TextSizePreferences() {
  const { level, setLevel } = useTextScale()

  return (
    <div className="space-y-6">
      <p className="text-[16px] leading-relaxed text-ink-soft">
        Ustaw, jak duży ma być tekst przepisów. Zmiana zapisuje się na tym urządzeniu.
      </p>

      <TextSizeControls level={level} onChange={setLevel} />

      <section
        aria-labelledby="text-size-preview-heading"
        className="rounded-tile border border-border-card bg-surface-2 p-4 sm:p-6"
      >
        <h2 id="text-size-preview-heading" className="mb-4 text-[17px] font-bold text-ink-soft">
          Podgląd
        </h2>
        {/* Mirrors the recipe layout: 19 px on the parent, .text-scalable on the text, so
            the sample grows with the chosen level exactly like Składniki / Przygotowanie. */}
        <div className="text-[19px]">
          <div className="flex items-center justify-between gap-3 border-b-[1.5px] border-border-card py-1.5">
            <span className="text-scalable min-w-0 flex-1 break-words leading-snug text-ink">mąka pszenna</span>
            <b className="text-scalable max-w-[45%] text-right text-ink">2 szklanki</b>
          </div>
          <p className="mt-4 mb-1.5 text-[17px] font-bold text-action-text">Krok 1</p>
          <p className="text-scalable leading-[1.6] text-ink">
            Wymieszaj mąkę z cukrem, dodaj roztopione masło i zagnieć gładkie ciasto.
          </p>
        </div>
      </section>
    </div>
  )
}
