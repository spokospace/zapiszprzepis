import Link from 'next/link'
import { Lock } from 'lucide-react'
import { buttonClasses } from '@/app/components/ui/button'
import { photosLabel } from '@/lib/recipe-meta'

/**
 * The gallery as a guest sees it (E01-S07): a locked teaser with the photo count
 * and "Zaloguj się" that returns here. The photos themselves are a login perk
 * (decision Q3): only their count is public.
 */
export function LockedGallery({ count, loginHref }: { count: number; loginHref: string }) {
  return (
    <section aria-labelledby="gallery-heading" className="mb-12">
      <h2 id="gallery-heading" className="mb-4 text-[26px] font-bold text-ink">
        Zdjęcia
      </h2>
      <div className="rounded-card border-2 border-dashed border-border-card-2 bg-surface-accent px-5 py-6 text-center">
        <Lock aria-hidden="true" size={32} className="mx-auto text-ink-soft" />
        <p className="mb-4 mt-2 text-[19px] font-bold text-ink">Galeria {photosLabel(count)} po zalogowaniu</p>
        <Link href={loginHref} className={buttonClasses('primary', 'lg')}>
          Zaloguj się
        </Link>
      </div>
    </section>
  )
}
