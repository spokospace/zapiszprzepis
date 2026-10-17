import { useSyncExternalStore } from 'react'

const noop = () => () => {}

/** false during SSR and hydration, true afterwards — without a setState-in-effect. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false)
}
