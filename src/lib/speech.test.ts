import { describe, it, expect } from 'vitest'
import { isSpeechRecognitionSupported, speechRecognitionCtor } from './speech'

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
