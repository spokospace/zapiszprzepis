import Link from 'next/link'
import { BookOpen, Heart, Plus, type LucideIcon } from 'lucide-react'

interface Tile {
  href: string
  title: string
  caption: string
  Icon: LucideIcon
}

const MY_RECIPES: Tile = { href: '/recipes', title: 'Moje przepisy', caption: 'Przepisy dodane przez Ciebie', Icon: BookOpen }
const FAVORITES: Tile = { href: '/ulubione', title: 'Ulubione', caption: 'Przepisy zapisane na później', Icon: Heart }
// `?tab=add` focuses the add-from-link form further down the home (E01-S04
// slot); E01-S10 repoints this to /dodaj.
const ADD_RECIPE: Tile = { href: '/?tab=add', title: 'Dodaj przepis', caption: 'Wklej link do przepisu', Icon: Plus }

/**
 * Shortcut tiles on the signed-in home (E01-S04). "Moje przepisy" is for users
 * with full access only (E01-S11 supplies the flag).
 */
export function MemberTiles({ hasFullAccess }: { hasFullAccess: boolean }) {
  const tiles = hasFullAccess ? [MY_RECIPES, FAVORITES, ADD_RECIPE] : [FAVORITES, ADD_RECIPE]
  return (
    <nav aria-label="Skróty">
      <ul className="flex flex-col gap-2.5">
        {tiles.map(({ href, title, caption, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-[72px] items-center gap-3 rounded-card border-2 border-border-card bg-white px-4 py-3 hover:border-border-card-2 hover:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-surface-accent-2 text-action-text"
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[19px] font-bold text-ink">{title}</span>
                <span className="block text-[16px] text-ink-soft">{caption}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
