'use client'

import type { MouseEvent, ReactNode } from 'react'
import { History, Mic, Search, TrendingUp } from 'lucide-react'
import { SuggestionRowContent } from './search/suggestion-row'

/** One row of the desktop header search panel; the field drives it as a combobox. */
export type HeaderSearchOption =
  | { kind: 'recent' | 'popular' | 'all'; id: string; label: string; href: string }
  | {
      kind: 'suggestion'
      id: string
      label: string
      category: string
      imageUrl: string | null
      href: string
      slug: string
    }

/** Keep the field focused when the panel is pressed, so its blur does not close the panel first. */
function keepFocus(event: MouseEvent) {
  event.preventDefault()
}

/** A combobox `option`: selected via the field's keyboard or a click, never a tab stop. */
function Option({
  option,
  activeId,
  className,
  onSelect,
  onHover,
  children,
}: {
  option: HeaderSearchOption
  activeId: string | null
  className: string
  onSelect: (option: HeaderSearchOption) => void
  onHover: (id: string) => void
  children: ReactNode
}) {
  return (
    <div
      role="option"
      id={option.id}
      aria-selected={option.id === activeId}
      onMouseEnter={() => onHover(option.id)}
      onClick={() => onSelect(option)}
      className={`${className} ${option.id === activeId ? 'bg-surface-3!' : 'hover:bg-surface-3'}`}
    >
      {children}
    </div>
  )
}

/**
 * The anchored dropdown under the desktop header search field (E01-S17 follow-up):
 * the desktop twin of the mobile full-screen /szukaj (E01-S26). While the field is
 * empty it offers „Powiedz”, „Ostatnio i często szukane”; once two letters are typed
 * it offers live „Podpowiedzi” and „Pokaż wszystkie wyniki”. The field owns the
 * keyboard (combobox); the rows are `option`s it activates, so the panel is not a
 * second tab stop. `lg` only — it lives inside the `hidden lg:flex` header field.
 */
export function HeaderSearchPanel({
  listboxId,
  options,
  activeId,
  browsing,
  hasRecent,
  query,
  micSupported,
  onVoice,
  onSelect,
  onHover,
}: {
  listboxId: string
  options: HeaderSearchOption[]
  activeId: string | null
  browsing: boolean
  hasRecent: boolean
  query: string
  micSupported: boolean
  onVoice: () => void
  onSelect: (option: HeaderSearchOption) => void
  onHover: (id: string | null) => void
}) {
  return (
    <div
      onMouseDown={keepFocus}
      onMouseLeave={() => onHover(null)}
      // ZMIANY_prototyp §5b: a 2 px #6b7280 frame (3:1 on white), radius 16, a deep
      // soft shadow, 6 px below the field.
      className="absolute top-[calc(100%+6px)] left-0 z-30 max-h-[70vh] w-full min-w-[20rem] overflow-y-auto rounded-2xl border-2 border-border-dark bg-white py-2 shadow-[0_12px_28px_rgba(17,24,39,0.18)]"
    >
      {browsing && micSupported && (
        <button
          type="button"
          onClick={onVoice}
          className="mx-2 mb-1 inline-flex min-h-12 items-center gap-2 rounded-pill border-2 border-ink px-3 text-[17px] font-bold text-ink hover:bg-surface-3"
        >
          <Mic aria-hidden="true" className="h-[22px] w-[22px]" />
          Powiedz
        </button>
      )}

      <p id={`${listboxId}-label`} className="px-3 pb-1 text-[16px] font-bold text-ink-soft">
        {browsing ? (hasRecent ? 'Ostatnio i często szukane' : 'Często szukane') : 'Podpowiedzi'}
      </p>

      <div role="listbox" id={listboxId} aria-labelledby={`${listboxId}-label`}>
        {browsing ? (
          <div className="flex flex-wrap gap-2 px-3 py-1">
            {options.map((option) => (
              <Option
                key={option.id}
                option={option}
                activeId={activeId}
                onSelect={onSelect}
                onHover={onHover}
                className={`inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-pill border-2 px-4 text-[17px] font-bold whitespace-nowrap text-ink ${
                  option.kind === 'recent' ? 'border-field' : 'border-accent-dark bg-surface-accent'
                }`}
              >
                {option.kind === 'recent' ? (
                  <History aria-hidden="true" className="h-5 w-5" />
                ) : (
                  <TrendingUp aria-hidden="true" className="h-5 w-5" />
                )}
                {option.label}
              </Option>
            ))}
          </div>
        ) : (
          options.map((option) =>
            option.kind === 'suggestion' ? (
              <Option
                key={option.id}
                option={option}
                activeId={activeId}
                onSelect={onSelect}
                onHover={onHover}
                className="flex min-h-16 cursor-pointer items-center gap-3 border-t border-border-card px-3 py-2 text-ink first:border-t-0"
              >
                <SuggestionRowContent title={option.label} category={option.category} imageUrl={option.imageUrl} />
              </Option>
            ) : (
              <Option
                key={option.id}
                option={option}
                activeId={activeId}
                onSelect={onSelect}
                onHover={onHover}
                className="flex min-h-12 cursor-pointer items-center gap-2 border-t border-border-card px-3 py-2 text-[18px] font-bold wrap-anywhere text-action-text first:border-t-0"
              >
                <Search aria-hidden="true" className="h-5 w-5 shrink-0" />
                Pokaż wszystkie wyniki dla „{query}”
              </Option>
            ),
          )
        )}
      </div>
    </div>
  )
}
