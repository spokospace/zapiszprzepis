'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { popularMinusRecent } from '@/lib/home'
import { recipePath, SEARCH_PATH, searchPath } from '@/lib/routes'
import { SUGGEST_MIN_LENGTH } from '@/lib/search'
import { useFieldValue } from '@/app/szukaj/_components/use-field-value'
import { useRecentSearches } from '@/app/szukaj/_components/use-recent-searches'
import { rememberSearchList } from './search/remember-search-list'
import { ListeningScreen } from './home/listening-screen'
import { MIC_STATUS, useVoiceField } from './search/use-voice-field'
import { useSuggestions } from './search/use-suggestions'
import { HeaderSearchPanel, type HeaderSearchOption } from './header-search-panel'

const LISTBOX_ID = 'header-search-panel'

/**
 * The signed-in desktop header's search (E01-S17, A9), reworked into the one search
 * surface for desktop (E01-S17 follow-up): a plain GET form to SEARCH_PATH, so it
 * works without JS, enhanced into a combobox whose anchored panel (recent, popular,
 * live suggestions, „Powiedz”) is the desktop twin of the mobile full-screen search.
 * On /szukaj it prefills the active query and the page drops its own desktop field,
 * so nothing duplicates. Its landmark name differs from the page forms' labels so two
 * search landmarks never collide.
 */
export function HeaderSearch({ className = '' }: { className?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  // Prefill only on the results page, where the header field is the one input.
  const initialQuery = pathname === SEARCH_PATH ? (searchParams.get('q') ?? '') : ''

  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { micSupported, micState, heard, startListening, stopListening, clearError } = useVoiceField(inputRef, formRef)

  const value = useFieldValue('header-search', initialQuery)
  const query = value.trim()
  const typed = value !== initialQuery
  const browsing = query.length < SUGGEST_MIN_LENGTH

  const { recent } = useRecentSearches()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Fetch only while the panel is open and a real query is being typed — never on page
  // load or for a prefilled /szukaj query.
  const suggestions = useSuggestions(open && typed && !browsing ? query : '')

  // „Ostatnio i często szukane” while empty; live „Podpowiedzi” once two letters are
  // typed. A query loaded on /szukaj (not typed) shows neither — the results are below.
  const options: HeaderSearchOption[] = []
  if (browsing) {
    recent.forEach((term, i) => options.push({ kind: 'recent', id: `hs-recent-${i}`, label: term, href: searchPath(term) }))
    popularMinusRecent(recent).forEach((term, i) =>
      options.push({ kind: 'popular', id: `hs-popular-${i}`, label: term, href: searchPath(term) }),
    )
  } else if (typed) {
    for (const s of suggestions) {
      options.push({
        kind: 'suggestion',
        id: `hs-sugg-${s.slug}`,
        label: s.title,
        category: s.category,
        imageUrl: s.image_url,
        href: recipePath(s.slug, { from: 'szukaj' }),
        slug: s.slug,
      })
    }
    options.push({ kind: 'all', id: 'hs-all', label: query, href: searchPath(query) })
  }

  const hasPanel = open && options.length > 0
  const activeOption = hasPanel && activeIndex >= 0 && activeIndex < options.length ? options[activeIndex] : null

  function close() {
    setOpen(false)
    setActiveIndex(-1)
  }

  function move(direction: 1 | -1) {
    if (options.length === 0) return
    setOpen(true)
    setActiveIndex((i) =>
      i < 0 ? (direction === 1 ? 0 : options.length - 1) : (i + direction + options.length) % options.length,
    )
  }

  function select(option: HeaderSearchOption) {
    // A recipe opened from here leads back „← Wyniki” to this query's results (E01-S28).
    if (option.kind === 'suggestion') rememberSearchList(query, suggestions)
    close()
    router.push(option.href)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Enter' && activeOption) {
      // A picked row wins over the plain GET submit.
      event.preventDefault()
      select(activeOption)
    } else if (event.key === 'Escape' && hasPanel) {
      event.preventDefault()
      close()
    }
  }

  const micMessage = MIC_STATUS[micState]

  return (
    <form
      ref={formRef}
      role="search"
      aria-label="Szukaj w serwisie"
      method="get"
      action={SEARCH_PATH}
      className={`relative min-w-0 max-w-[460px] flex-1 ${className}`}
    >
      <div className="flex min-w-0 flex-1 gap-2">
        <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-field border-2 border-field bg-white pr-1 pl-3 has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus">
          <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-soft" />
          <label htmlFor="header-search" className="sr-only">
            Szukaj przepisu lub składnika
          </label>
          <input
            ref={inputRef}
            id="header-search"
            type="search"
            name="q"
            required
            role="combobox"
            aria-expanded={hasPanel}
            aria-controls={LISTBOX_ID}
            aria-activedescendant={activeOption ? activeOption.id : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            enterKeyHint="search"
            defaultValue={initialQuery}
            placeholder="Przepis lub składnik"
            onFocus={() => setOpen(true)}
            onBlur={close}
            onInput={clearError}
            onKeyDown={onKeyDown}
            className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-ink placeholder:text-ink-muted focus-visible:outline-none! [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
        {/* The search icon lives in the field; the submit is text only, so the header
            does not show two magnifying glasses side by side. */}
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center rounded-field border-2 border-field bg-white px-4 text-[17px] font-bold text-ink hover:bg-surface-3"
        >
          Szukaj
        </button>
      </div>

      {hasPanel && (
        <HeaderSearchPanel
          listboxId={LISTBOX_ID}
          options={options}
          activeId={activeOption?.id ?? null}
          browsing={browsing}
          hasRecent={recent.length > 0}
          query={query}
          micSupported={micSupported}
          onVoice={startListening}
          onSelect={select}
          onHover={(id) => setActiveIndex(id ? options.findIndex((o) => o.id === id) : -1)}
        />
      )}

      {micMessage && (
        <p
          role="status"
          aria-live="polite"
          className="absolute top-[calc(100%+6px)] left-0 z-30 w-full rounded-field border-2 border-border-card bg-white px-3 py-2 text-[16px] text-ink shadow-lg"
        >
          {micMessage}
        </p>
      )}

      {micState === 'listening' && <ListeningScreen heard={heard} onStop={stopListening} />}
    </form>
  )
}
