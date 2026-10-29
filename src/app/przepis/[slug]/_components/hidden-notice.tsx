import Link from 'next/link'
import { PageContainer } from '@/app/components/page-container'
import { buttonClasses } from '@/app/components/ui/button'

/**
 * What the owner of a hidden recipe, or somebody who favorited it, sees at its URL:
 * the page exists for them (a 404 would read as a bug), but says nothing about the
 * recipe. The metadata keeps it out of every index.
 */
export function UnavailableRecipe() {
  return (
    <main className="min-h-screen bg-white py-12">
      <PageContainer narrow>
        <h1 className="mb-3 text-2xl font-bold text-ink">Przepis jest niedostępny</h1>
        <p className="mb-6 max-w-prose text-[18px] text-ink-soft">
          Ten przepis został tymczasowo ukryty. Jeśli to Twoje ulubione, zostanie na liście, a gdy wróci, otworzy się
          jak dawniej.
        </p>
        <Link href="/ulubione" className={buttonClasses('outline', 'md')}>
          Wróć do ulubionych
        </Link>
      </PageContainer>
    </main>
  )
}

/** The banner staff see above a hidden recipe, with the way into the panel. */
export function StaffHiddenBanner({ reason, recipeId }: { reason: string | null; recipeId: number }) {
  return (
    <div role="status" className="mb-4 border-y-2 border-danger bg-danger-bg print:hidden">
      <PageContainer className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <strong className="text-danger">Ukryty</strong>
        <span className="text-ink">
          Tego przepisu nie widzą goście ani użytkownicy. Widzisz go jako członek zespołu.
          {reason ? ` Powód: ${reason}` : ''}
        </span>
        <Link
          href={`/admin/przepisy/${recipeId}`}
          className="min-h-touch inline-flex items-center font-semibold text-ink underline underline-offset-4"
        >
          Otwórz w panelu
        </Link>
      </PageContainer>
    </div>
  )
}
