'use client'

import { useEffect } from 'react'
import { useTextScale } from './ui/use-text-scale'

/**
 * The single owner of the `--text-scale` custom property on <html>: it reads the
 * saved per-device level (via useTextScale) and publishes it so every `.text-scalable`
 * / `.text-scalable-body` element follows it on EVERY screen — the recipe page included,
 * which no longer carries its own control (the control lives on /wyswietlanie).
 *
 * Mounted once in the root layout beside PWARegister; renders nothing. The property is
 * written after hydration (the SSR snapshot is 'A' = 1, so server and first client
 * render match), identical to the pre-move recipe-page behaviour — only now app-wide
 * and always on, instead of scoped to one mounted component.
 */
export function TextScaleApplier() {
  const { scale } = useTextScale()

  // Mounted once in the root layout and never unmounted, so it just publishes the
  // current scale — no cleanup to restore (a cleanup would only add a redundant
  // unset→reset on each change; globals.css already defines the `--text-scale: 1` default).
  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(scale))
  }, [scale])

  return null
}
