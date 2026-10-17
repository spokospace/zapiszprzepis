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
    <div className="flex items-center gap-3">
      <span id="text-size-label" className="min-w-0 text-[16px] font-bold wrap-anywhere text-ink-soft">
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
              className={`min-h-[48px] min-w-[52px] rounded-field border-2 px-3 font-bold leading-none transition-colors ${
                active ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-border-card-2 hover:bg-surface-3'
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
