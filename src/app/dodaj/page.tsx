import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getSignedInUser } from '@/lib/supabase/server'
import { getFullAccess } from '@/lib/full-access'
import { ADD_RECIPE_PATH, parseAddRecipeError } from '@/lib/routes'
import { loginPath } from '@/lib/login-redirect'
import { PageContainer } from '@/app/components/page-container'
import { AccessCodeGate } from '@/app/components/access-code-gate'
import { AddRecipePanel } from './add-recipe-panel'

export const metadata: Metadata = { title: 'Dodaj przepis · Zapisz Przepis', robots: { index: false } }

type SearchParams = Promise<{ add_error?: string | string[] }>

/**
 * E01-S10 — adding a recipe (A7). With full access: the source tiles, the link
 * form and the three steps. Without it: the access-code gate (3c), which swaps
 * in the same panel once a code is accepted. This check only picks the screen;
 * addRecipeFromUrl and RLS enforce access on every add.
 */
export default async function AddRecipePage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createSupabaseServerClient()
  // The access RPC fails closed for a guest, so it can run alongside the user lookup.
  const [user, hasFullAccess, { add_error }] = await Promise.all([
    getSignedInUser(),
    getFullAccess(supabase),
    searchParams,
  ])
  // Middleware already sends a guest to login; this keeps the page safe on its own.
  if (!user) redirect(loginPath(ADD_RECIPE_PATH))
  const error = parseAddRecipeError(add_error)

  return (
    <main className="min-h-screen bg-white pb-10">
      <PageContainer className="py-6">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <h1 className="text-[30px] leading-tight font-bold text-ink">Dodaj przepis</h1>
          {hasFullAccess ? (
            <AddRecipePanel error={error} />
          ) : (
            <AccessCodeGate notice={error === 'no_access'} unlocked={<AddRecipePanel autoFocus />} />
          )}
        </div>
      </PageContainer>
    </main>
  )
}
