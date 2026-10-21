'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Mic, Search, X } from 'lucide-react'
import { buttonClasses } from '@/app/components/ui/button'
import { SEARCH_PATH, searchPath, type SearchScope } from '@/lib/routes'
import { MIC_STATUS, useVoiceField } from '../search/use-voice-field'
import { ListeningScreen } from './listening-screen'

interface HomeSearchProps {
  id: string
  /** The current query on /szukaj (E01-S05); shows "× Wyczyść". Remount with `key={q}` when it changes. */
  defaultValue?: string
  /** Searches stay in this scope; `wszystkie` adds no field. */
  scope?: SearchScope
  label?: string
  autoFocus?: boolean
  /** The field frame: `field` grey (default), `action` orange for the guest hero (A1, E01-S20). */
  tone?: 'field' | 'action'
  placeholder?: string
  /** A bold ink label (C1 "Czego szukasz?") instead of the soft hint style. */
  strongLabel?: boolean
  /** One submit label at every width; default "Szukaj przepisu", shortened to "Szukaj" from lg. */
  submitLabel?: string
  /**
   * The results page (C2): the label is for screen readers only, „× Wyczyść” sits
   * inside the field (in place of the mic while there is a query), and below lg
   * there is no submit button — the keyboard's search key submits (enterKeyHint).
   * Keeps the first result high on a phone.
   */
  compact?: boolean
  /**
   * The home hero (handoff 14): a visible bold label, a pill field with a text „Szukaj”
   * button inside it (60 px, 68 px from lg), and „albo” + „Powiedz, czego szukasz” in a
   * row below the field — „Powiedz” is no longer inside it. Hero only.
   */
  attached?: boolean
}

const FRAME = { field: 'border-field', action: 'border-ink' } as const

/** The „albo” + „Powiedz, czego szukasz” row: left on a phone, centered under the field from md (handoff 14). */
export const VOICE_ROW_CLASS = 'mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-2 md:justify-center'

/**
 * The one search field (E01-S04 home, E01-S05 /szukaj and "Moje przepisy"): a
 * plain GET form to SEARCH_PATH, so it works before hydration and without JS.
 * „Powiedz” is progressive enhancement, rendered only where the Web Speech API
 * exists: it opens the „Słucham…” screen with the words heard so far, and after a
 * pause the phrase fills the field and submits it (E01-S27).
 */
export function HomeSearch({
  id,
  defaultValue,
  scope = 'wszystkie',
  label = 'Szukaj przepisu po nazwie lub składniku',
  autoFocus,
  tone = 'field',
  placeholder = 'np. sernik, pierogi',
  strongLabel,
  submitLabel,
  compact,
  attached,
}: HomeSearchProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { micSupported, micState, heard, startListening, stopListening, setFieldValue, clearError } = useVoiceField(
    inputRef,
    formRef,
  )
  // „Powiedz” while the field is empty, „Wyczyść” once something is typed (handoff v8).
  const [hasText, setHasText] = useState(Boolean(defaultValue))

  const sharedInput = {
    ref: inputRef,
    id,
    name: 'q',
    required: true,
    defaultValue,
    autoFocus,
    enterKeyHint: 'search' as const,
    autoComplete: 'off',
    placeholder,
    onInput: (event: React.FormEvent<HTMLInputElement>) => {
      setHasText(event.currentTarget.value.length > 0)
      clearError()
    },
  }

  // „Powiedz” buttons share one handler; only the classes and label differ.
  const voiceButton = (className: string, buttonLabel: string) =>
    micSupported && (
      <button type="button" onClick={startListening} className={className}>
        <Mic aria-hidden="true" className="h-[22px] w-[22px] shrink-0" />
        <span className="min-w-0 wrap-anywhere">{buttonLabel}</span>
      </button>
    )

  return (
    <form ref={formRef} role="search" method="get" action={SEARCH_PATH}>
      <label
        htmlFor={id}
        className={
          compact
            ? 'sr-only'
            : attached
              ? 'mb-2.5 block text-[19px] font-bold text-ink'
              : `mb-2 block text-[18px] ${strongLabel ? 'font-bold text-ink' : 'text-ink-soft'}`
        }
      >
        {label}
      </label>
      {scope !== 'wszystkie' && <input type="hidden" name="zakres" value={scope} />}

      {attached ? (
        <>
          {/* One pill field (60 px, 68 px from lg) with a text „Szukaj” button inside it. */}
          <div
            className={`flex items-center gap-2 rounded-pill border-2 ${FRAME[tone]} bg-white pr-[5px] pl-6 has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus`}
          >
            <input
              {...sharedInput}
              type="search"
              className="h-14 min-w-0 flex-1 bg-transparent text-[19px] text-ink placeholder:text-[17px] placeholder:text-ink-muted focus-visible:outline-none! lg:h-16 lg:placeholder:text-[19px] [&::-webkit-search-cancel-button]:appearance-none"
            />
            <button
              type="submit"
              className="inline-flex h-12 shrink-0 items-center rounded-pill bg-action px-5 text-[19px] font-bold text-white transition-colors hover:bg-action-hover lg:h-14 lg:px-8"
            >
              {submitLabel ?? 'Szukaj'}
            </button>
          </div>
          {/* „Powiedz” lives outside the field, in its own row; no row at all without the Web Speech API. */}
          {micSupported && (
            <div className={VOICE_ROW_CLASS}>
              <span className="text-[18px] text-ink-soft">albo</span>
              {voiceButton(
                'inline-flex h-[52px] max-w-full items-center gap-2 rounded-pill border-2 border-ink bg-white px-[18px] text-[18px] font-bold text-ink hover:bg-surface-3',
                'Powiedz, czego szukasz',
              )}
            </div>
          )}
        </>
      ) : (
        // Below lg the submit wraps to its own full-width line (gap-y = the old mt-3);
        // from lg (E01-S17, A8) it sits inline in a 760×64 row. The mic sits inside the
        // field frame (E01-S20), which takes the focus ring while the input is focused.
        <div className="flex flex-wrap gap-x-2 gap-y-3 lg:max-w-[760px]">
          <div
            className={`flex h-[60px] min-w-0 flex-1 basis-full items-center gap-2 rounded-pill border-2 ${FRAME[tone]} bg-white pr-1 pl-3 has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus lg:h-16 lg:basis-0`}
          >
            <Search aria-hidden="true" className="h-[22px] w-[22px] shrink-0 text-ink-soft" />
            <input
              {...sharedInput}
              type="search"
              className="h-full min-w-0 flex-1 bg-transparent text-[19px] text-ink placeholder:text-[17px] placeholder:text-ink-muted focus-visible:outline-none! [&::-webkit-search-cancel-button]:appearance-none"
            />
            {/* The browser's own ✕ of type="search" is hidden: „Wyczyść” is the one,
                labelled clear button (an unlabelled ✕ beside it read as two controls). */}
            {compact && defaultValue && hasText ? (
              <Link
                href={searchPath('', scope)}
                className="inline-flex h-12 shrink-0 items-center gap-1 rounded-pill px-2 text-[17px] font-bold text-ink no-underline! hover:bg-surface-3"
              >
                <X aria-hidden="true" className="h-5 w-5" />
                Wyczyść
              </Link>
            ) : hasText && (compact || !defaultValue) ? (
              // The page's own „Wyczyść” link sits below the field when it has a query.
              <button
                type="button"
                onClick={() => {
                  setFieldValue('')
                  inputRef.current?.focus()
                }}
                className="inline-flex h-12 shrink-0 items-center gap-1 rounded-pill px-2 text-[17px] font-bold text-ink hover:bg-surface-3"
              >
                <X aria-hidden="true" className="h-5 w-5" />
                Wyczyść
              </button>
            ) : (
              micSupported &&
              !hasText && (
                <button
                  type="button"
                  onClick={startListening}
                  className="inline-flex h-12 shrink-0 items-center gap-1 rounded-pill border-2 border-field px-2 text-[16px] font-bold text-ink hover:bg-surface-3"
                >
                  <Mic aria-hidden="true" className="h-[22px] w-[22px]" />
                  Powiedz
                </button>
              )
            )}
          </div>
          <button
            type="submit"
            className={`${buttonClasses('primary', 'lg')} min-h-[58px] w-full text-[19px] lg:h-16 lg:w-auto lg:px-8 ${compact ? 'max-lg:hidden' : ''}`}
          >
            <Search aria-hidden="true" className="h-5 w-5" />
            {submitLabel ?? (
              <>
                <span className="lg:hidden">Szukaj przepisu</span>
                <span className="hidden lg:inline">Szukaj</span>
              </>
            )}
          </button>
        </div>
      )}

      <p role="status" aria-live="polite" className="mt-2 text-[16px] text-ink-soft empty:sr-only">
        {MIC_STATUS[micState]}
      </p>
      {micState === 'listening' && <ListeningScreen heard={heard} onStop={stopListening} />}
      {defaultValue && !compact && !attached && (
        <div className="mt-1 flex justify-end">
          <Link
            href={searchPath('', scope)}
            className="inline-flex min-h-[48px] items-center gap-1.5 px-1 text-[18px] font-bold text-ink no-underline!"
          >
            <X aria-hidden="true" className="h-5 w-5" />
            Wyczyść
          </Link>
        </div>
      )}
    </form>
  )
}
