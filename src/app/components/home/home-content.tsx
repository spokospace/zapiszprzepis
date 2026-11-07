'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageContainer } from '@/app/components/page-container'
import { FavoriteAddedNotice } from '@/app/components/favorite-button'
import { LoadingStatus, RecipeGridSkeleton } from '@/app/components/recipe-card-skeleton'
import { RecipeRow } from './recipe-row'
import { loadBrowserClient, useBrowserSession } from '@/lib/browser-session'
import { FAVORITE_ADDED_PARAM, parseRecipeId } from '@/lib/favorites'
import { GREETING_LEAD, greetingSuffix } from '@/lib/home'
import { readGreetingCache, writeGreetingCache } from '@/lib/greeting-cache'
import { getMemberHome, type MemberHomeData } from '@/lib/member-home'
import type { MenuSummary } from '@/lib/menu-summary'
import { ADD_RECIPE_PATH } from '@/lib/routes'
import { vocative } from '@/lib/vocative'

const NOTHING: MemberHomeData = { greetingName: undefined, mine: [], favorites: [] }

/** Keeps the rows on screen when the reader comes back to the home, while they reload. */
let lastLoaded: { userId: string; home: MemberHomeData } | null = null

function useMemberHome(userId: string | null): MemberHomeData | null {
  const [loaded, setLoaded] = useState(lastLoaded)

  useEffect(() => {
    if (!userId) return
    let current = true
    loadBrowserClient()
      .then((supabase) => getMemberHome(supabase, userId))
      .catch(() => NOTHING)
      .then((home) => {
        lastLoaded = { userId, home }
        if (!current) return
        // Only while this reader is still signed in (a sign-out ends the effect, and its cleared
        // cache must not come back), and a failed read is not an answer (#737).
        if (home.greetingName !== undefined) writeGreetingCache(userId, vocative(home.greetingName))
        setLoaded(lastLoaded)
      })
    return () => {
      current = false
    }
  }, [userId])

  return loaded?.userId === userId ? loaded.home : null
}

/**
 * The greeting name this browser remembers for this reader (#737): the vocative, '' for "no
 * name", null when unknown or when the entry belongs to someone else. Read in render, which
 * is safe because `userId` is only set after hydration, so the first renders still match the
 * server HTML (where CSS shows the same name from `--zp-greeting`).
 */
function useCachedGreeting(userId: string | null): string | null {
  return useMemo(() => {
    if (!userId) return null
    const cached = readGreetingCache()
    return cached?.userId === userId ? cached.name : null
  }, [userId])
}

/** Gives up waiting for the name after this long and shows the plain greeting. */
const GREETING_WAIT_MS = 3000

/** The address bar's one-shot asks, which the shared page cannot read on the server. */
function useHomeParams(): number | null {
  const [favoriteAdded, setFavoriteAdded] = useState<number | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // The add form left the home for /dodaj (E01-S10); old `/?tab=add` links follow it.
    if (params.get('tab') === 'add') window.location.replace(ADD_RECIPE_PATH)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavoriteAdded(parseRecipeId(params.get(FAVORITE_ADDED_PARAM)))
  }, [])

  return favoriteAdded
}

/**
 * The hero both homes share (handoff 14): one column with searching as the only task.
 * From md it is centered (H1 up to 64 px, field block at most 780 px); on a phone it is
 * left-aligned (handoff 14, 3c/3d: padding 28/16/24, gap 14, H1 36 px). „Przepis dnia” is no longer in here — it is its
 * own block under a rule, rendered by the page after the hero.
 */
function Hero({
  id,
  title,
  titlePending,
  titleHeld,
  titleGuest,
  subtitle,
  children,
}: {
  id: string
  title: ReactNode
  /** The heading waits for the reader's name: hidden (CSS) for a reader with a session and no cached answer. */
  titlePending: boolean
  /** Hidden whatever the cache says: the reader is known and still has no name to show. */
  titleHeld: boolean
  /** The session turned out to be a guest's (a stale cookie): no reserved height. */
  titleGuest: boolean
  subtitle: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="bg-white">
      <PageContainer className="flex flex-col items-start gap-3.5 pt-7 pb-6 md:items-center md:gap-[18px] md:pt-16 md:pb-[52px] md:text-center">
        {/* max-w-full: under items-start a flex child is as wide as its longest word;
            at a large system font (or a long run-together word) that word outgrew a phone
            and widened the page (#448). The subtitle needs the same cap as the heading. */}
        <h1
          id={id}
          className={`hero-title ${titlePending ? 'greeting-pending' : ''} ${titleHeld ? 'greeting-held' : ''} ${titleGuest ? 'is-guest' : ''} max-w-full text-[36px] leading-[1.05] font-extrabold text-ink md:text-[48px] lg:text-[64px] lg:leading-[1.02]`}
        >
          {title}
        </h1>
        <p className="max-w-full text-[19px] leading-normal text-ink-soft md:text-[20px] md:leading-[1.45]">{subtitle}</p>
        <div className="w-full max-w-[780px] text-left md:mt-3.5">{children}</div>
      </PageContainer>
    </section>
  )
}

const MEMBER_SUBTITLE = 'Szukaj w swoich przepisach i ulubionych albo we wszystkich.'

const GUEST_SUBTITLE = (
  <>
    Przepisy z internetu w jednym miejscu.
    {/* Second sentence starts a new line on a phone only; from md the subtitle flows as one line. */}
    <br className="md:hidden" /> Zawsze pod ręką, kiedy gotujesz.
  </>
)

function MemberRows({
  home,
  menu,
  favoriteAdded,
}: {
  home: MemberHomeData
  menu: MenuSummary | null
  /** A guest-home card heart's login round-trip ends here (E01-S06); a row card shows the toast itself when it holds that recipe. */
  favoriteAdded: number | null
}) {
  const mine = menu?.hasFullAccess ? home.mine : []
  const { favorites } = home
  const withCount = (label: string, count: number | null | undefined) => (count == null ? `${label} →` : `${label} (${count}) →`)
  const shown = new Set([...mine, ...favorites].map((r) => r.id))
  return (
    <>
      {favoriteAdded !== null && !shown.has(favoriteAdded) && <FavoriteAddedNotice recipeId={favoriteAdded} />}
      {mine.length > 0 && (
        <RecipeRow
          id="mine-heading"
          heading="Ostatnio dodane przez Ciebie"
          listKey="moje"
          href="/recipes"
          recipes={mine}
          more={{ href: '/recipes', label: withCount('Wszystkie moje', menu?.myRecipesCount) }}
        />
      )}
      {favorites.length > 0 && (
        <RecipeRow
          id="favorites-heading"
          heading="Ulubione"
          listKey="fav"
          href="/ulubione"
          recipes={favorites}
          more={{ href: '/ulubione', label: withCount('Wszystkie ulubione', menu?.favoritesCount) }}
        />
      )}
      {mine.length === 0 && favorites.length === 0 && (
        // Nothing to show yet: one door to the first recipe (the add page; without full
        // access it shows the access-code gate, 3c).
        <Link
          href={ADD_RECIPE_PATH}
          className="flex min-h-16 items-center gap-3.5 rounded-tile border border-ink bg-white p-4 text-[20px] font-bold text-ink no-underline! hover:border-border-card-2 hover:bg-surface-2"
        >
          <Plus aria-hidden="true" className="h-7 w-7 shrink-0 text-action-text" />
          {/* min-w-0 + break-words: the label shrinks and wraps instead of widening the
              flex row past the phone at a large font (WCAG 1.4.10). */}
          <span className="min-w-0 break-words">Dodaj pierwszy przepis</span>
        </Link>
      )}
    </>
  )
}

/**
 * The home for everyone: the page comes from the server without knowing who reads it, and
 * the greeting and the signed-in rows replace the guest's in the browser. The search stays
 * mounted through that swap, so a query already being typed survives it.
 */
export function HomeContent({
  search,
  recipeOfDay,
  categories,
  guestRows,
}: {
  search: ReactNode
  recipeOfDay: ReactNode
  categories: ReactNode
  guestRows: ReactNode
}) {
  const session = useBrowserSession()
  const userId = session.status === 'user' ? session.userId : null
  const menu = session.status === 'user' ? session.menu : undefined
  const home = useMemberHome(userId)
  const favoriteAdded = useHomeParams()
  const cachedName = useCachedGreeting(userId)
  // The database's answer wins over the remembered one.
  const name = home && home.greetingName !== undefined ? (vocative(home.greetingName) ?? '') : cachedName
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    if (!userId || name !== null) return
    const timer = setTimeout(() => setGaveUp(true), GREETING_WAIT_MS)
    return () => clearTimeout(timer)
  }, [userId, name])
  const guest = session.status === 'guest'

  return (
    <>
      <Hero
        id="hero-heading"
        titlePending={!guest && name === null && !gaveUp}
        // Once the session is read the span is React's: CSS must not paint a remembered name over
        // it (another account's, or one the database no longer has).
        titleHeld={userId !== null && name === null && !gaveUp}
        titleGuest={guest}
        title={
          <>
            {GREETING_LEAD}
            {/* Empty until the name is known; CSS paints the remembered one meanwhile. */}
            <span className={`greet-name ${guest || userId !== null ? 'greet-off' : ''}`}>{greetingSuffix(name)}</span>?
          </>
        }
        subtitle={
          guest ? (
            GUEST_SUBTITLE
          ) : (
            // Both are in the page HTML; the session cookie (html[data-session]) picks the member's
            // before the first paint, so it does not wait for the session to be read.
            <>
              <span className="hero-sub-guest">{GUEST_SUBTITLE}</span>
              <span className="hero-sub-member">{MEMBER_SUBTITLE}</span>
            </>
          )
        }
      >
        {search}
      </Hero>
      {recipeOfDay}
      <PageContainer className="flex flex-col gap-8 pt-6">
        {categories}
        {!userId ? (
          // The inline script in the page marks a reader with a session cookie, who must
          // not see the guest's rows blink before the session is read.
          <div className={`flex flex-col gap-8 ${session.status === 'unknown' ? 'session-pending' : ''}`}>{guestRows}</div>
        ) : home && menu !== undefined ? (
          <MemberRows home={home} menu={menu} favoriteAdded={favoriteAdded} />
        ) : (
          <>
            <LoadingStatus>Wczytuję Twoje przepisy</LoadingStatus>
            <div aria-hidden="true">
              <RecipeGridSkeleton count={4} className="grid grid-cols-2 gap-5 lg:grid-cols-4" />
            </div>
          </>
        )}
      </PageContainer>
    </>
  )
}
