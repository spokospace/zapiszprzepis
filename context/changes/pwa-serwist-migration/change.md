---
change_id: pwa-serwist-migration
title: Migrate PWA from next-pwa to @serwist/next
status: parked
created: 2026-07-04
updated: 2026-07-04
archived_at: null
---

## Why

`next-pwa@5.6.0` (shadowwalker) is abandoned since Dec 2022 and carries a HIGH
`serialize-javascript` vulnerability (RCE via `RegExp.flags`) in its build chain:
`next-pwa > workbox-webpack-plugin > workbox-build > rollup-plugin-terser`.
No patch is available in the `next-pwa` tree — the fix requires replacing the package.

The obvious intermediate target (`@ducanh2912/next-pwa`) is also semi-abandoned —
last release Sep 2024, author explicitly recommends migrating to `@serwist/next`.

`@serwist/next` is the proper successor: actively maintained (v9.5.11, May 2026),
355K weekly downloads, same DuCanhGH author.

## Why parked

The serialize-javascript RCE is **build-time only** — it runs during `pnpm build`
inside the bundler, not in production. For a solo local dev environment the actual
risk is negligible. The migration was deferred at the MVP stage because:

- Requires Android device testing (PWA install flow, Web Share Target, update lifecycle)
- `register: false` + `skipWaiting: false` (conservative update strategy) needs
  end-to-end verification after the switch — the app must not force-reload on mum's
  device mid-session
- Serwist has a different architecture (you write a `sw.ts` source file instead of
  letting the plugin generate everything)

## What the migration involves

1. `pnpm remove next-pwa && pnpm add @serwist/next && pnpm add -D serwist`
2. Rewrite `next.config.ts`: `withPWA({dest,…})(base)` → `withSerwistInit({swSrc,swDest,…})(base)`
3. Create `app/sw.ts` (or `src/sw.ts`) — service worker source using `new Serwist({…})`
   - Set `skipWaiting: false` and `clientsClaim: true` directly in this file
   - Keep `register: false` in the plugin config (manual SW registration stays)
4. Update `tsconfig.json`: add `"webworker"` to `lib`, add `@serwist/next/typings` to `types`,
   add `"exclude": ["public/sw.js"]`
5. Update `.gitignore`: add `public/sw*` and `public/swe-worker*`
6. Delete the pre-generated `public/sw.js` from git (will be generated at build time)

## Verification checklist (requires Android device)

- [ ] `pnpm build` completes without errors, generates `public/sw.js`
- [ ] PWA installs correctly from Chrome on Android
- [ ] Web Share Target receives shared URLs from the Android share sheet
- [ ] Service worker enters "waiting" state after a new deploy (does not auto-activate)
- [ ] Manual update flow works (mum gets prompted, accepts, page reloads cleanly)
- [ ] Offline fallback page appears when network is unavailable
- [ ] `pnpm audit` shows 0 HIGH findings after migration

## Reference

- Serwist docs: https://serwist.pages.dev/docs/next/getting-started
- @ducanh2912/next-pwa → @serwist/next migration note:
  https://www.npmjs.com/package/@ducanh2912/next-pwa
