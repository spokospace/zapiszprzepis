'use client'

import { TEXT_SCALE_LEVELS, type TextScaleLevel } from './use-text-scale'

interface TextSizeControlsProps {
  level: TextScaleLevel
  onChange: (level: TextScaleLevel) => void
}

/**
 * "Wielkość tekstu" A / A+ / A++ control (handoff recipe screen). Buttons are a
 * labelled radiogroup; the active level is announced via aria-checked. Wire to
 * useTextScale and spread its scaleStyle on the scalable content container.
 */
export function TextSizeControls({ level, onChange }: TextSizeControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <span id="text-size-label" className="text-[16px] font-bold text-ink-soft">
        Wielkość tekstu
      </span>
      <div role="radiogroup" aria-labelledby="text-size-label" className="flex gap-2">
        {TEXT_SCALE_LEVELS.map((l) => {
          const active = l === level
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={active}
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
