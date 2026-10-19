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
      <h2 id="gallery-heading" className="mb-4 text-[24px] font-bold text-ink">
        Zdjęcia
      </h2>
      {/* A5: a neutral #f9fafb box with a 1.5 px dashed #d1d5db edge, a plain sentence
          and a 48 px dark "Zaloguj się" — the orange stays for the page's main action. */}
      <div className="flex flex-col items-center gap-2.5 rounded-field border-[1.5px] border-dashed border-border-card-2 bg-surface-2 p-5 text-center">
        <Lock aria-hidden="true" size={26} className="text-ink-soft" />
        <p className="text-[18px] leading-[1.45] text-ink">Galeria {photosLabel(count)} jest dostępna po zalogowaniu.</p>
        <Link href={loginHref} className={buttonClasses('dark', 'md')}>
          Zaloguj się
        </Link>
      </div>
    </section>
  )
}
