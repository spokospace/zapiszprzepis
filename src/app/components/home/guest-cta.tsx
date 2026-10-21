import Link from 'next/link'
import { buttonClasses } from '@/app/components/ui/button'

/**
 * Sign-up / log-in block at the bottom of the guest home (E01-S04). Style 1b: no
 * background, a 1 px ink rule above, white outline button for „Zaloguj się”.
 */
export function GuestCta() {
  return (
    <section aria-labelledby="guest-cta-heading" className="border-t border-ink pt-6">
      <h2 id="guest-cta-heading" className="text-[22px] leading-snug font-bold text-ink">
        Zapisuj przepisy z linku i zbieraj ulubione
      </h2>
      <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">
        Po zalogowaniu dodasz własne przepisy, zobaczysz galerię zdjęć i zapiszesz ulubione.
      </p>
      <div className="mt-4 flex flex-col gap-2.5 min-[360px]:flex-row lg:max-w-[480px]">
        <Link href="/signup" className={`${buttonClasses('primary', 'lg')} flex-1 no-underline!`}>
          Załóż konto
        </Link>
        <Link href="/login" className={`${buttonClasses('outline', 'lg')} flex-1 no-underline!`}>
          Zaloguj się
        </Link>
      </div>
    </section>
  )
}
