import { describe, it, expect, vi } from 'vitest'
import { createScreenWakeLock, type SentinelLike, type WakeLockEnv } from '@/lib/wake-lock'

class FakeSentinel implements SentinelLike {
  released = false
  private listeners: (() => void)[] = []
  release = vi.fn(async () => {
    this.drop()
  })
  addEventListener(_type: 'release', listener: () => void) {
    this.listeners.push(listener)
  }
  /** The system (or release()) dropping the lock fires `release`. */
  drop() {
    if (this.released) return
    this.released = true
    this.listeners.forEach((l) => l())
  }
}

function setup({ supported = true, visible = true, reject = false } = {}) {
  const sentinels: FakeSentinel[] = []
  const listeners = new Set<() => void>()
  const doc = {
    visibilityState: visible ? 'visible' : 'hidden',
    addEventListener: vi.fn((_t: 'visibilitychange', l: () => void) => void listeners.add(l)),
    removeEventListener: vi.fn((_t: 'visibilitychange', l: () => void) => void listeners.delete(l)),
  }
  const request = vi.fn(async () => {
    if (reject) throw new DOMException('denied', 'NotAllowedError')
    const s = new FakeSentinel()
    sentinels.push(s)
    return s
  })
  const env: WakeLockEnv = { navigator: supported ? { wakeLock: { request } } : {}, document: doc }
  const setVisible = async (v: boolean) => {
    doc.visibilityState = v ? 'visible' : 'hidden'
    listeners.forEach((l) => l())
    await Promise.resolve()
    await Promise.resolve()
  }
  return { lock: createScreenWakeLock(env), request, sentinels, listeners, doc, setVisible }
}

describe('createScreenWakeLock', () => {
  it('does nothing and never throws without the API', async () => {
    const { lock, listeners } = setup({ supported: false })
    expect(lock.isSupported).toBe(false)
    await expect(lock.acquire()).resolves.toBe(false)
    await expect(lock.release()).resolves.toBeUndefined()
    expect(listeners.size).toBe(0)
  })

  it('requests a screen lock', async () => {
    const { lock, request } = setup()
    expect(lock.isSupported).toBe(true)
    await expect(lock.acquire()).resolves.toBe(true)
    expect(request).toHaveBeenCalledWith('screen')
  })

  it('resolves false when the browser refuses', async () => {
    const { lock } = setup({ reject: true })
    await expect(lock.acquire()).resolves.toBe(false)
  })

  it('does not request while the page is hidden, then takes the lock on return', async () => {
    const { lock, request, setVisible } = setup({ visible: false })
    await expect(lock.acquire()).resolves.toBe(false)
    expect(request).not.toHaveBeenCalled()
    await setVisible(true)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('re-takes a lock the system dropped when the tab is visible again', async () => {
    const { lock, request, sentinels, setVisible } = setup()
    await lock.acquire()
    await setVisible(false)
    sentinels[0].drop()
    await setVisible(true)
    expect(request).toHaveBeenCalledTimes(2)
    expect(sentinels[1].released).toBe(false)
  })

  it('does not request twice while the lock is held', async () => {
    const { lock, request, setVisible } = setup()
    await lock.acquire()
    await lock.acquire()
    await setVisible(true)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('releases the sentinel, stops listening and is idempotent', async () => {
    const { lock, request, sentinels, listeners, setVisible } = setup()
    await lock.acquire()
    await lock.release()
    await lock.release()
    expect(sentinels[0].release).toHaveBeenCalledTimes(1)
    expect(listeners.size).toBe(0)
    await setVisible(true)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('releases a lock that arrives after release() was called', async () => {
    const { lock, sentinels } = setup()
    const acquiring = lock.acquire()
    await lock.release()
    await expect(acquiring).resolves.toBe(false)
    expect(sentinels[0].released).toBe(true)
  })
})
