import Link from 'next/link'
import { BookOpen, ChevronRight, Heart, Lock, Plus, type LucideIcon } from 'lucide-react'
import { ADD_RECIPE_PATH } from '@/lib/routes'
import { recipesNoun } from '@/app/components/app-menu-model'

interface Tile {
  href: string
  title: string
  caption: string
  Icon: LucideIcon
}

const MY_RECIPES: Tile = { href: '/recipes', title: 'Moje przepisy', caption: 'Przepisy dodane przez Ciebie', Icon: BookOpen }
const FAVORITES: Tile = { href: '/ulubione', title: 'Ulubione', caption: 'Przepisy zapisane na później', Icon: Heart }
// The add page (E01-S10).
const ADD_RECIPE: Tile = { href: ADD_RECIPE_PATH, title: 'Dodaj przepis', caption: 'Wklej link do przepisu', Icon: Plus }
// Without full access the same tile leads to the access-code gate (3c), which
// /dodaj shows in place of the form; worded like the MENU drawer's locked entry (E01-S09).
const ADD_RECIPE_LOCKED: Tile = { ...ADD_RECIPE, caption: 'Wymaga kodu lub pełnego dostępu', Icon: Lock }

/** "24 dodane przez Ciebie" (C1), with the participle agreeing with the number. */
export function addedByYouCaption(count: number): string {
  const lastDigit = count % 10
  const lastTwo = count % 100
  const form =
    count === 1 ? 'dodany' : lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'dodane' : 'dodanych'
  return `${count} ${form} przez Ciebie`
}

/**
 * Shortcut rows on the signed-in home (E01-S04; the C1 look since E01-S20:
 * 28 px icon, 20 px title, 16 px caption, chevron, the whole row is the link).
 * "Moje przepisy" is for users with full access only (E01-S11 supplies the flag).
 */
export function MemberTiles({
  hasFullAccess,
  myRecipesCount = null,
  favoritesCount = null,
}: {
  hasFullAccess: boolean
  /** The MENU summary's counters (C1 captions); null or 0 keeps the plain caption. */
  myRecipesCount?: number | null
  favoritesCount?: number | null
}) {
  const mine = !myRecipesCount ? MY_RECIPES : { ...MY_RECIPES, caption: addedByYouCaption(myRecipesCount) }
  const favorites =
    !favoritesCount ? FAVORITES : { ...FAVORITES, caption: `${favoritesCount} ${recipesNoun(favoritesCount)}` }
  const tiles = hasFullAccess ? [mine, favorites, ADD_RECIPE] : [favorites, ADD_RECIPE_LOCKED]
  return (
    <nav aria-label="Skróty">
      <ul className="flex flex-col gap-2.5">
        {tiles.map(({ href, title, caption, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-16 items-center gap-3.5 rounded-card border-2 border-border-card bg-white p-4 no-underline! hover:border-border-card-2 hover:bg-surface-2"
            >
              <Icon aria-hidden="true" className="h-7 w-7 shrink-0 text-action-text" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[20px] leading-tight font-bold text-ink">{title}</span>
                <span className="text-[16px] text-ink-soft">{caption}</span>
              </span>
              <ChevronRight aria-hidden="true" className="h-[26px] w-[26px] shrink-0 text-ink-soft" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
