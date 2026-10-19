import Link from 'next/link'
import { buttonClasses } from '@/app/components/ui/button'

/**
 * Sign-up / log-in block at the bottom of the guest home (E01-S04; the dark
 * A1 look since E01-S20). The default blue focus ring is ~2.3:1 on
 * `surface-dark`, so the block swaps it for `accent-dark`, like cooking mode.
 */
export function GuestCta() {
  return (
    <section
      aria-labelledby="guest-cta-heading"
      className="rounded-card bg-surface-dark px-5 py-5 text-white [&_*]:outline-accent-dark [&_:focus-visible]:outline-accent-dark!"
    >
      <h2 id="guest-cta-heading" className="text-[20px] leading-snug font-bold">
        Zapisuj przepisy z linku i zbieraj ulubione
      </h2>
      <p className="mt-2 text-[17px] leading-relaxed text-border-card">
        Po zalogowaniu dodasz własne przepisy, zobaczysz galerię zdjęć i zapiszesz ulubione.
      </p>
      <div className="mt-4 flex flex-col gap-2.5 min-[360px]:flex-row lg:max-w-[480px]">
        <Link href="/signup" className={`${buttonClasses('primary', 'lg')} flex-1 no-underline!`}>
          Załóż konto
        </Link>
        {/* The outline button for a dark surface: `border-dark` keeps the 3:1 frame. */}
        <Link
          href="/login"
          className="inline-flex min-h-[56px] flex-1 items-center justify-center rounded-field border-2 border-border-dark px-5 text-[18px] leading-tight font-bold wrap-anywhere text-white no-underline! hover:bg-white/10"
        >
          Zaloguj się
        </Link>
      </div>
    </section>
  )
}
