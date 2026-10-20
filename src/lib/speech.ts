/** Minimal shape of the Web Speech API recognizer the app uses. */
export interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  /** `error` is the SpeechRecognitionErrorEvent code: 'aborted' follows our own abort(), 'no-speech' a silent timeout. */
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  /** Ends recognition without delivering a result. */
  abort(): void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

/**
 * The browser's speech recognizer constructor (standard or webkit-prefixed),
 * or null where unsupported (Firefox, many iOS PWAs). Takes the window so it
 * stays testable without a DOM.
 */
export function speechRecognitionCtor(win: object): SpeechRecognitionCtor | null {
  const w = win as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(win: object): boolean {
  return speechRecognitionCtor(win) !== null
}

/**
 * The phrase heard so far: every result's best alternative, in order. With
 * `interimResults` the last result is still changing; it is shown live on the
 * „Słucham…” screen (E01-S27) and searched once the recognizer ends.
 */
export function transcriptOf(results: ArrayLike<ArrayLike<{ transcript: string }>>): string {
  return Array.from(results, (r) => r[0]?.transcript ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * What a recognizer error means for the user: `ignore` our own abort(), `idle`
 * silence, `denied` a blocked microphone (explain how to allow it), else `error`.
 */
export function micErrorKind(code: string): 'ignore' | 'idle' | 'denied' | 'error' {
  if (code === 'aborted') return 'ignore'
  if (code === 'no-speech') return 'idle'
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied'
  return 'error'
}

export type VoiceState = 'listening' | 'idle' | 'error' | 'denied'

export interface VoiceSearchHandlers {
  /** The words heard so far, live (interim results). */
  onHeard: (text: string) => void
  onState: (state: VoiceState) => void
  /** The recognizer ended by itself after a pause with something heard: search it. */
  onSearch: (phrase: string) => void
}

/**
 * One „Powiedz” session (E01-S27): Polish, interim results, a search after the
 * pause that ends recognition. `stop()` („Przestań słuchać i pisz”) aborts without
 * searching and returns what was heard, for the field. Kept free of React and the
 * DOM so the states are tested with a fake recognizer.
 */
export function startVoiceSearch(Recognizer: SpeechRecognitionCtor, handlers: VoiceSearchHandlers) {
  const recognition = new Recognizer()
  let heard = ''
  let finished = false
  recognition.lang = 'pl-PL'
  recognition.interimResults = true
  recognition.maxAlternatives = 1
  recognition.onresult = (event) => {
    heard = transcriptOf(event.results)
    handlers.onHeard(heard)
  }
  recognition.onerror = (event) => {
    // 'aborted' follows our own abort(): a deliberate cancel, not a failure.
    const kind = micErrorKind(event.error)
    if (kind === 'ignore' || finished) return
    finished = true
    handlers.onState(kind)
  }
  recognition.onend = () => {
    if (finished) return
    finished = true
    handlers.onState('idle')
    if (heard) handlers.onSearch(heard)
  }
  handlers.onHeard('')
  handlers.onState('listening')
  recognition.start()
  return {
    /** abort, not stop: stop() would still end with a search. */
    stop(): string {
      if (!finished) {
        finished = true
        handlers.onState('idle')
      }
      recognition.abort()
      return heard
    },
  }
}
