/** Minimal shape of the Web Speech API recognizer the app uses. */
export interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
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
