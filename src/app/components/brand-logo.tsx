import Image from 'next/image'

/**
 * The brand logo (#276): the recipe icon followed by „Zapisz Przepis” set as text.
 * Shared by the navbar and /login (#331) so the two cannot drift apart again; the
 * old lettering image must not come back anywhere (#320, guarded by a test).
 */
export function LogoIcon({ className = 'h-10 w-10' }: { className?: string }) {
  return <Image src="/logo-icon.svg" alt="" width={40} height={40} unoptimized priority className={className} />
}

/**
 * The standalone logo on the auth screens (3a /login, /signup): not a link, so it
 * carries one accessible name, „Zapisz Przepis”, as the old image's alt did.
 */
export function BrandLogo() {
  return (
    <div role="img" aria-label="Zapisz Przepis" className="flex items-center gap-2 self-start">
      <LogoIcon />
      <LogoWordmark />
    </div>
  )
}

/**
 * Decorative: the surrounding link or `role="img"` element carries the name.
 * Two words, „Zapisz Przepis” (handoff v8, #339); the gap is a margin, not a JSX
 * space, so formatting can never drop it.
 */
export function LogoWordmark({ className = 'text-[1.625rem]' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`font-bold ${className}`}>
      <span className="text-gray-900">Zapisz</span>
      <span className="ml-[.28em] text-action">Przepis</span>
    </span>
  )
}
