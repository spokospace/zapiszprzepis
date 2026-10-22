'use client'

import { TEXT_SCALE_LEVELS, type TextScaleLevel } from './use-text-scale'

interface TextSizeControlsProps {
  level: TextScaleLevel
  onChange: (level: TextScaleLevel) => void
}

/**
 * "Wielkość tekstu" A / A+ / A++ control (handoff recipe screen). A labelled group
 * of toggle buttons; the active level is announced via aria-pressed. (Not a
 * radiogroup: that ARIA pattern requires a roving tabindex and arrow keys.) Wire to
 * useTextScale and spread its scaleStyle on the scalable content container.
 */
export function TextSizeControls({ level, onChange }: TextSizeControlsProps) {
  return (
    // C3: a #f3f4f6 panel, the label on the left and the buttons on the right. flex-wrap: at a
    // large system font the label would shrink to a letter or two beside the shrink-0 buttons,
    // so the buttons drop to their own row instead (#478).
    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-tile bg-surface-3 py-2 pr-2 pl-4">
      <span id="text-size-label" className="min-w-0 text-[16px] font-bold wrap-label text-ink">
        Wielkość tekstu
      </span>
      <div role="group" aria-labelledby="text-size-label" className="flex shrink-0 gap-2">
        {TEXT_SCALE_LEVELS.map((l) => {
          const active = l === level
          return (
            <button
              key={l}
              type="button"
              aria-pressed={active}
              aria-label={`Wielkość tekstu ${l}`}
              onClick={() => onChange(l)}
              className={`min-h-[48px] min-w-[52px] rounded-pill border-2 px-3 font-bold leading-none transition-colors ${
                active ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-ink hover:bg-surface-3'
              }`}
              style={{ fontSize: l === 'A' ? 17 : l === 'A+' ? 19 : 22 }}
            >
              {l}
            </button>
          )
        })}
      </div>
    </div>
  )
}
