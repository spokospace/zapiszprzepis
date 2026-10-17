import Link from 'next/link'
import { buttonClasses } from '@/app/components/ui/button'

/** Sign-up / log-in block at the bottom of the guest home (E01-S04). */
export function GuestCta() {
  return (
    <section aria-labelledby="guest-cta-heading" className="rounded-card bg-surface-2 px-4 py-5">
      <h2 id="guest-cta-heading" className="text-[22px] font-bold text-ink">
        Zapisuj ulubione przepisy
      </h2>
      <p className="mt-1 text-[19px] text-ink-soft">Załóż konto, żeby mieć swoje przepisy zawsze pod ręką.</p>
      <div className="mt-4 flex flex-col gap-2.5">
        <Link href="/signup" className={`${buttonClasses('primary', 'lg')} w-full`}>
          Załóż konto
        </Link>
        <Link href="/login" className={`${buttonClasses('outline', 'lg')} w-full`}>
          Zaloguj się
        </Link>
      </div>
    </section>
  )
}
