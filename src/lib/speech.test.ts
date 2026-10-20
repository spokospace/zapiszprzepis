import { describe, it, expect } from 'vitest'
import {
  isSpeechRecognitionSupported,
  micErrorKind,
  speechRecognitionCtor,
  startVoiceSearch,
  transcriptOf,
  type SpeechRecognitionLike,
  type VoiceState,
} from './speech'

class FakeRecognition {}

describe('speechRecognitionCtor', () => {
  it('prefers the standard constructor', () => {
    expect(speechRecognitionCtor({ SpeechRecognition: FakeRecognition, webkitSpeechRecognition: class {} })).toBe(
      FakeRecognition,
    )
  })

  it('falls back to the webkit-prefixed constructor', () => {
    expect(speechRecognitionCtor({ webkitSpeechRecognition: FakeRecognition })).toBe(FakeRecognition)
  })

  it('is null where the API is absent', () => {
    expect(speechRecognitionCtor({})).toBeNull()
    expect(isSpeechRecognitionSupported({})).toBe(false)
    expect(isSpeechRecognitionSupported({ webkitSpeechRecognition: FakeRecognition })).toBe(true)
  })
})

describe('transcriptOf (E01-S27)', () => {
  it('joins each result\'s best alternative, interim ones included', () => {
    expect(transcriptOf([[{ transcript: 'zupa' }], [{ transcript: ' z dyni' }]])).toBe('zupa z dyni')
  })

  it('is empty when nothing was heard', () => {
    expect(transcriptOf([])).toBe('')
    expect(transcriptOf([[]])).toBe('')
  })
})

describe('micErrorKind', () => {
  it('ignores our own abort and treats silence as idle', () => {
    expect(micErrorKind('aborted')).toBe('ignore')
    expect(micErrorKind('no-speech')).toBe('idle')
  })

  it('explains a blocked microphone separately from other failures', () => {
    expect(micErrorKind('not-allowed')).toBe('denied')
    expect(micErrorKind('service-not-allowed')).toBe('denied')
    expect(micErrorKind('network')).toBe('error')
  })
})

/** A recognizer the test drives by hand: results, errors and the end of speech. */
class ScriptedRecognition implements SpeechRecognitionLike {
  static last: ScriptedRecognition
  lang = ''
  interimResults = false
  maxAlternatives = 0
  onresult: SpeechRecognitionLike['onresult'] = null
  onerror: SpeechRecognitionLike['onerror'] = null
  onend: SpeechRecognitionLike['onend'] = null
  started = false
  aborted = false
  constructor() {
    ScriptedRecognition.last = this
  }
  start() {
    this.started = true
  }
  stop() {}
  abort() {
    this.aborted = true
    // Chrome reports an abort as an error, then ends.
    this.onerror?.({ error: 'aborted' })
    this.onend?.()
  }
  say(...parts: string[]) {
    this.onresult?.({ results: parts.map((p) => [{ transcript: p }]) })
  }
}

function session() {
  const states: VoiceState[] = []
  const heard: string[] = []
  const searched: string[] = []
  const voice = startVoiceSearch(ScriptedRecognition, {
    onHeard: (t) => heard.push(t),
    onState: (s) => states.push(s),
    onSearch: (p) => searched.push(p),
  })
  return { voice, rec: ScriptedRecognition.last, states, heard, searched }
}

describe('startVoiceSearch (E01-S27)', () => {
  it('listens in Polish with interim results and shows the words live', () => {
    const { rec, states, heard } = session()
    expect(rec.started).toBe(true)
    expect(rec.lang).toBe('pl-PL')
    expect(rec.interimResults).toBe(true)
    rec.say('zupa')
    rec.say('zupa', ' z dyni')
    expect(states).toEqual(['listening'])
    expect(heard).toEqual(['', 'zupa', 'zupa z dyni'])
  })

  it('searches what was heard once speech ends after a pause', () => {
    const { rec, states, searched } = session()
    rec.say('pierogi')
    rec.onend?.()
    expect(states).toEqual(['listening', 'idle'])
    expect(searched).toEqual(['pierogi'])
  })

  it('does not search when nothing was heard', () => {
    const { rec, searched, states } = session()
    rec.onerror?.({ error: 'no-speech' })
    rec.onend?.()
    expect(searched).toEqual([])
    expect(states).toEqual(['listening', 'idle'])
  })

  it('„Przestań słuchać i pisz” aborts without searching and hands back the words', () => {
    const { voice, rec, searched, states } = session()
    rec.say('sernik')
    expect(voice.stop()).toBe('sernik')
    expect(rec.aborted).toBe(true)
    expect(searched).toEqual([])
    expect(states).toEqual(['listening', 'idle'])
  })

  it('reports a blocked microphone as denied, and other failures as errors', () => {
    const denied = session()
    denied.rec.onerror?.({ error: 'not-allowed' })
    denied.rec.onend?.()
    expect(denied.states).toEqual(['listening', 'denied'])
    expect(denied.searched).toEqual([])

    const failed = session()
    failed.rec.say('ro')
    failed.rec.onerror?.({ error: 'network' })
    failed.rec.onend?.()
    expect(failed.states).toEqual(['listening', 'error'])
    expect(failed.searched).toEqual([])
  })
})
