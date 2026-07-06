---
id: desktop-layout-widening
title: Desktop layout widening
status: preparing
created: 2026-07-06
updated: 2026-07-06
---

## Goal

Improve the desktop layout so all views display correctly on large screens. Currently the home page is constrained to 624px visible content and the recipe detail page to 768px, while the recipe list and header already use 1152px (max-w-6xl).

## Scope

- Home page (`/`) — `max-w-2xl` → widen
- Recipe detail page (`/recipes/[slug]`) — `max-w-3xl` → widen
- Auth pages — review (currently no max-width, centred by flexbox)
