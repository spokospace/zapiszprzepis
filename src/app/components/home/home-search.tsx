'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Mic, Search, X } from 'lucide-react'
import { buttonClasses } from '@/app/components/ui/button'
import { SEARCH_PATH, searchPath, type SearchScope } from '@/lib/routes'
import { isSpeechRecognitionSupported, speechRecognitionCtor, type SpeechRecognitionLike } from '@/lib/speech'

type MicState = 'idle' | 'listening' | 'error'

const MIC_STATUS: Record<MicState, string> = {
  idle: '',
  listening: 'Słucham… powiedz, czego szukasz.',
  error: 'Nie udało się rozpoznać mowy. Wpisz nazwę przepisu.',
}

interface HomeSearchProps {
  id: string
  /** The current query on /szukaj (E01-S05); shows "× Wyczyść". Remount with `key={q}` when it changes. */
  defaultValue?: string
  /** Searches stay in this scope; `wszystkie` adds no field. */
  scope?: SearchScope
  label?: string
  autoFocus?: boolean
  /** Centre the field row from lg (the guest hero, E01-S17). */
  centered?: boolean
}

/**
 * The one search field (E01-S04 home, E01-S05 /szukaj and "Moje przepisy"): a
 * plain GET form to SEARCH_PATH, so it works before hydration and without JS.
 * The mic button is progressive enhancement, rendered only where the Web Speech
 * API exists; the recognised phrase fills the field and submits it.
 */
export function HomeSearch({
  id,
  defaultValue,
  scope = 'wszystkie',
  label = 'Szukaj przepisu po nazwie lub składniku',
  autoFocus,
  centered,
}: HomeSearchProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [micSupported, setMicSupported] = useState(false)
  const [micState, setMicState] = useState<MicState>('idle')

  useEffect(() => {
    // Mount-only capability probe: `window` cannot be read during render
    // without desyncing hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicSupported(isSpeechRecognitionSupported(window))
    return () => recognitionRef.current?.abort()
  }, [])

  function toggleMic() {
    if (micState === 'listening') {
      // abort, not stop: stop() would still deliver the partial phrase and submit it.
      recognitionRef.current?.abort()
      setMicState('idle')
      return
    }
    const SR = speechRecognitionCtor(window)
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'pl-PL'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (!transcript || !inputRef.current) return
      inputRef.current.value = transcript
      formRef.current?.requestSubmit()
    }
    recognition.onerror = (event) => {
      // Chrome fires 'aborted' after our own abort() (second tap, unmount): a
      // deliberate cancel, not a failure. Silence just returns to idle.
      if (event.error === 'aborted') return
      setMicState(event.error === 'no-speech' ? 'idle' : 'error')
    }
    recognition.onend = () => setMicState((prev) => (prev === 'listening' ? 'idle' : prev))
    recognitionRef.current = recognition
    setMicState('listening')
    recognition.start()
  }

  return (
    <form ref={formRef} role="search" method="get" action={SEARCH_PATH}>
      <label htmlFor={id} className="mb-2 block text-[18px] text-ink-soft">
        {label}
      </label>
      {scope !== 'wszystkie' && <input type="hidden" name="zakres" value={scope} />}
      {/* Below lg the submit wraps to its own full-width line (gap-y = the old mt-3);
          from lg (E01-S17, A8) it sits inline in a 760×64 row. */}
      <div className={`flex flex-wrap gap-x-2 gap-y-3 lg:max-w-[760px] ${centered ? 'lg:mx-auto' : ''}`}>
        <input
          ref={inputRef}
          id={id}
          type="search"
          name="q"
          required
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          enterKeyHint="search"
          autoComplete="off"
          onInput={() => setMicState((prev) => (prev === 'error' ? 'idle' : prev))}
          placeholder="np. sernik, pierogi"
          className="h-[60px] min-w-0 flex-1 rounded-field border-2 border-field bg-white px-4 text-[19px] text-ink placeholder:text-ink-muted lg:h-16"
        />
        {micSupported && (
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={micState === 'listening'}
            className="inline-flex h-[60px] shrink-0 items-center gap-1.5 rounded-field border-2 border-field bg-white px-3 text-[17px] font-bold text-ink hover:bg-surface-3 lg:h-16"
          >
            <Mic aria-hidden="true" className="h-5 w-5" />
            Mów
          </button>
        )}
        <button type="submit" className={`${buttonClasses('primary', 'lg')} w-full text-[19px] lg:h-16 lg:w-auto lg:px-8`}>
          <Search aria-hidden="true" className="h-5 w-5" />
          <span className="lg:hidden">Szukaj przepisu</span>
          <span className="hidden lg:inline">Szukaj</span>
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-[16px] text-ink-soft empty:sr-only">
        {MIC_STATUS[micState]}
      </p>
      {defaultValue && (
        <div className="mt-1 flex justify-end">
          <Link
            href={searchPath('', scope)}
            className="inline-flex min-h-[48px] items-center gap-1.5 px-1 text-[18px] text-ink underline underline-offset-4"
          >
            <X aria-hidden="true" className="h-5 w-5" />
            Wyczyść
          </Link>
        </div>
      )}
    </form>
  )
}
