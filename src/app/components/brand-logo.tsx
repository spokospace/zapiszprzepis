import Image from 'next/image'

/**
 * The brand logo (#276): the recipe icon followed by „ZapiszPrzepis” set as text.
 * Shared by the navbar and /login (#331) so the two cannot drift apart again; the
 * old lettering image must not come back anywhere (#320, guarded by a test).
 */
export function LogoIcon({ className = 'h-10 w-10' }: { className?: string }) {
  return <Image src="/logo-icon.svg" alt="" width={40} height={40} unoptimized priority className={className} />
}

/** Decorative: the surrounding link or `role="img"` element carries the name. */
export function LogoWordmark({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`text-[1.625rem] font-bold tracking-wide ${className}`}>
      <span className="text-gray-900">Zapisz</span>
      <span className="text-action">Przepis</span>
    </span>
  )
}
