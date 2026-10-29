import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// A recipe staff hide must vanish from every guest-facing reader (admin panel, Phase 2).
// The filter itself lives in SQL (`hidden_at is null` on public_recipes and recipe_gallery_images),
// which Vitest cannot run: supabase/tests/admin_recipe_moderation_guards.sql exercises it. What
// these tests pin is the other half — that each reader gets its recipes ONLY through the filtered
// views (or an RPC defined over them), never from the `recipes` table, where a hidden row is still
// readable. A reader that starts reading `recipes` directly fails here before it ships.
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
/** The source without comments, so prose that mentions a table does not trip a pattern. */
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const FROM_RECIPES = /\.from\(\s*['"]recipes['"]\s*\)/

/** One entry per reader in the Phase 2 list; `relation` is what it must read. */
const READERS: { name: string; file: string; relation: RegExp }[] = [
  { name: 'public_recipes (recipe page, category list, home feed, recipe of the day)', file: 'src/lib/recipe-cache.ts', relation: /from\('public_recipes'\)/ },
  { name: 'category facets (RPC over public_recipes)', file: 'src/lib/recipe-cache.ts', relation: /rpc\('category_tag_facets'/ },
  { name: 'listCanonicalRecipes / canonicalRecipeBySlug (sitemap, llms.txt, .md)', file: 'src/lib/public-recipe.ts', relation: /from\('public_recipes'\)/ },
  { name: 'search_recipes (RPC over public_recipes)', file: 'src/lib/search.ts', relation: /rpc\('search_recipes'/ },
  { name: 'category context (RPC over public_recipes)', file: 'src/app/przepis/[slug]/category-context.ts', relation: /rpc\('recipe_category_context'/ },
  { name: 'similar recipes', file: 'src/app/przepis/[slug]/_components/similar-recipes.tsx', relation: /from\('public_recipes'\)/ },
  { name: '/u/{username}', file: 'src/app/u/[username]/page.tsx', relation: /from\('public_recipes'\)/ },
  { name: 'notifications (recipe titles)', file: 'src/lib/notifications.ts', relation: /from\('public_recipes'\)/ },
]

describe('every guest-facing reader goes through the filtered views', () => {
  for (const { name, file, relation } of READERS) {
    it(`${name} reads ${relation.source} and never the recipes table`, () => {
      const source = code(file)
      expect(source).toMatch(relation)
      expect(source).not.toMatch(FROM_RECIPES)
    })
  }

  it('the sitemap, llms.txt and the .md route read through listCanonicalRecipes / canonicalRecipeBySlug', () => {
    expect(code('src/app/sitemap.ts')).toMatch(/listCanonicalRecipes/)
    expect(code('src/app/llms.txt/route.ts')).toMatch(/listCanonicalRecipes/)
    expect(code('src/app/przepis/[slug]/md/route.ts')).toMatch(/canonicalRecipeBySlug/)
    for (const file of ['src/app/sitemap.ts', 'src/app/llms.txt/route.ts', 'src/app/przepis/[slug]/md/route.ts']) {
      expect(code(file)).not.toMatch(FROM_RECIPES)
    }
  })

  it('the category list and the home page read recipes only through recipe-cache or scoped to the signed-in user', () => {
    expect(code('src/app/przepisy/[kategoria]/page.tsx')).not.toMatch(FROM_RECIPES)
    // The home page reads the member's OWN recipes from the table and must drop hidden ones.
    const home = code('src/app/page.tsx')
    const own = home.match(/\.from\('recipes'\)[\s\S]*?\.limit\(RECENT_LIMIT\)/)?.[0] ?? ''
    expect(own).toMatch(/\.eq\('user_id', userId\)/)
    expect(own).toMatch(/\.is\('hidden_at', null\)/)
  })

  it('the redirect lookup resolves its target through public_recipes, so it never lands on a hidden recipe', () => {
    const source = code('src/lib/merged-recipe-redirect.ts')
    expect(source).toMatch(/from\('public_recipes'\)/)
    expect(source).not.toMatch(FROM_RECIPES)
  })
})

describe('the hiding migration', () => {
  const sql = read('supabase/migrations/20261029100000_admin_recipe_hiding.sql').replace(/--.*$/gm, '')

  it('filters hidden recipes out of both public views and out of dish_versions', () => {
    expect(sql).toMatch(/create or replace view public\.public_recipes[\s\S]*?where r\.hidden_at is null/)
    expect(sql).toMatch(/create or replace view public\.recipe_gallery_images[\s\S]*?where r\.hidden_at is null/)
    const dish = sql.match(/function public\.dish_versions[\s\S]*?\$\$;/)?.[0] ?? ''
    expect((dish.match(/hidden_at is null/g) ?? []).length).toBe(2)
  })

  it('makes the boundary assertion fail when the filter is dropped or hidden_* is exposed', () => {
    expect(sql).toMatch(/pg_get_viewdef\(view_name::regclass\)[\s\S]*hidden_at\\s\+is\\s\+null/)
    expect(sql).toMatch(/array\['hidden_at', 'hidden_by', 'hidden_reason'\]/)
    expect(sql).toMatch(/select public\.assert_public_view_boundary\(\);/)
  })

  it('keeps recipes read-only for staff: a SELECT policy and no write grant', () => {
    expect(sql).toMatch(/create policy recipes_staff_select[\s\S]*?for select[\s\S]*?has_permission\('recipes\.read'\)/)
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*public\.recipes/i)
  })
})
