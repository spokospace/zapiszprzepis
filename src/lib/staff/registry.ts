import { MAX_TAGS, RECIPE_TAGS } from '@/lib/recipe-tags'
import { finishImportRetry } from './imports'
import type { ReadTool, ToolArg, WriteTool } from './mcp/types'
import type { StaffPermission } from './permissions'
import { finishRecipeMerge, finishRecipeSlug } from './recipe-finish'

/**
 * One thing staff can do to a resource. The panel and (Phase 4) the MCP are both
 * generated from this list, so a permission is declared once, next to the
 * operation it protects. `destructive` operations get a confirmation step in the
 * panel and a `confirm` argument on the MCP. The SQL function re-checks the
 * permission either way; this entry only decides what to show.
 */
export interface StaffOperation {
  name: string
  /** Polish, for the button. */
  label: string
  permission: StaffPermission
  destructive: boolean
  /**
   * How the MCP exposes it as the tool `<resource>_<operation>`. Absent: panel only.
   */
  mcp?: WriteTool
}

export interface StaffResource {
  name: string
  /** Polish, for the navigation. */
  label: string
  path: string
  /** What it takes to open the resource at all. */
  permission: StaffPermission
  operations: readonly StaffOperation[]
  /**
   * The read tools `<resource>_list` and `<resource>_get`, gated by `permission`.
   * Absent: the resource has no MCP reads.
   */
  mcp?: { list?: ReadTool; get?: ReadTool }
}

// Arguments several tools share. The MCP names are a contract; the `param` is the SQL name.
const arg = {
  userId: { name: 'user_id', param: 'p_user', type: 'uuid', description: 'Account id (uuid).', required: true },
  limit: (max: number, what: string): ToolArg => ({
    name: 'limit', param: 'p_limit', type: 'integer', min: 1, max, description: `How many ${what} to return (1-${max}).`,
  }),
  recipeId: { name: 'recipe_id', param: 'p_recipe', type: 'integer', min: 1, required: true, description: 'Recipe id from recipes_list.' },
  beforeId: { name: 'before_id', param: 'p_before_id', type: 'integer', min: 1, description: 'Return only rows with an id below this one (paging: pass the smallest id of the previous page).' },
} satisfies Record<string, ToolArg | ((...a: never[]) => ToolArg)>

export const STAFF_RESOURCES: readonly StaffResource[] = [
  {
    name: 'users',
    label: 'Użytkownicy',
    path: '/admin/uzytkownicy',
    permission: 'users.read',
    operations: [
      {
        name: 'block', label: 'Zablokuj konto', permission: 'users.block', destructive: true,
        mcp: {
          description: 'Block an account: it cannot sign in or refresh its session and its sessions are ended. Data stays. Refused for yourself and for staff accounts.',
          rpc: 'admin_block_user_as', target: 'user_id',
          args: [arg.userId, { name: 'reason', param: 'p_reason', type: 'string', maxLength: 200, description: 'Why (kept in the audit log).' }],
        },
      },
      {
        name: 'unblock', label: 'Odblokuj konto', permission: 'users.block', destructive: false,
        mcp: { description: 'Lift a block from an account.', rpc: 'admin_unblock_user_as', target: 'user_id', args: [arg.userId] },
      },
      {
        name: 'delete', label: 'Usuń konto i dane', permission: 'users.delete', destructive: true,
        mcp: {
          description: 'Permanently delete an account and its personal data. Recipes others favorited are handed to the oldest favoriter. Cannot be undone. Refused for yourself and for staff accounts.',
          rpc: 'admin_delete_user_as', target: 'user_id', args: [arg.userId],
        },
      },
    ],
    mcp: {
      list: {
        description: 'List accounts, newest first. E-mail is null (and not searchable) unless you hold users.read_email.',
        rpc: 'admin_list_users_as',
        args: [
          { name: 'query', param: 'p_query', type: 'string', maxLength: 100, description: 'Search by username or display name (and e-mail when permitted).' },
          arg.limit(50, 'accounts'),
          { name: 'after_created', param: 'p_after_created', type: 'timestamp', description: 'Paging: created_at of the last row of the previous page.' },
          { name: 'after_id', param: 'p_after_id', type: 'uuid', description: 'Paging: user_id of the last row of the previous page.' },
        ],
      },
      get: { description: 'Get one account.', rpc: 'admin_get_user_as', args: [arg.userId] },
    },
  },
  {
    name: 'imports',
    label: 'Kolejka importów',
    path: '/admin/importy',
    permission: 'imports.read',
    operations: [
      {
        name: 'retry', label: 'Ponów import', permission: 'imports.retry', destructive: false,
        mcp: {
          description: 'Run a failed or stuck recipe import again, as if its sharer had retried.',
          rpc: 'admin_retry_import_as', finish: finishImportRetry,
          args: [{ name: 'share_id', param: 'p_share', type: 'integer', min: 1, required: true, description: 'Import (share) id from imports_list.' }],
        },
      },
    ],
    mcp: {
      list: {
        description: 'List recipe imports, newest first. Default filter: problem (failed or stuck).',
        rpc: 'admin_list_imports_as',
        args: [
          { name: 'status', param: 'p_status', type: 'string', values: ['problem', 'failed', 'pending', 'completed', 'all'], description: 'Which imports to list.' },
          arg.limit(50, 'imports'),
          arg.beforeId,
        ],
      },
    },
  },
  {
    name: 'recipes',
    label: 'Przepisy',
    path: '/admin/przepisy',
    permission: 'recipes.read',
    operations: [
      {
        name: 'hide', label: 'Ukryj przepis', permission: 'recipes.hide', destructive: false,
        mcp: {
          description: 'Hide a recipe from everybody but staff (404 for guests, "unavailable" for its owner and favoriters). Reversible with recipes_unhide.',
          rpc: 'admin_hide_recipe_as', target: 'recipe_id', finish: finishRecipeSlug,
          args: [arg.recipeId, { name: 'reason', param: 'p_reason', type: 'string', maxLength: 200, description: 'Why (staff see it; kept in the audit log).' }],
        },
      },
      {
        name: 'unhide', label: 'Odkryj przepis', permission: 'recipes.hide', destructive: false,
        mcp: { description: 'Make a hidden recipe visible again.', rpc: 'admin_unhide_recipe_as', target: 'recipe_id', finish: finishRecipeSlug, args: [arg.recipeId] },
      },
      {
        name: 'delete', label: 'Usuń przepis', permission: 'recipes.delete', destructive: true,
        mcp: {
          description: 'Delete a recipe. A copy is archived first (an admin can bring it back with recipes_restore); its favorites are lost. The old address answers 404 unless redirect_to_slug is given.',
          rpc: 'admin_delete_recipe_as', target: 'recipe_id', finish: finishRecipeSlug,
          args: [arg.recipeId, { name: 'redirect_to_slug', param: 'p_redirect_to_slug', type: 'string', maxLength: 200, description: 'Slug of a visible recipe the old address should redirect (301) to. Omit for a plain 404.' }],
        },
      },
      {
        name: 'restore', label: 'Przywróć przepis', permission: 'recipes.restore', destructive: false,
        mcp: {
          description: 'Bring a recipe deleted by staff back under its old id and slug. Its favorites and import links are not restored. Refused when the slug or source link is taken again.',
          rpc: 'admin_restore_recipe_as', finish: finishRecipeSlug,
          args: [{ name: 'recipe_id', param: 'p_recipe', type: 'integer', min: 1, required: true, description: 'Id of the deleted recipe (it no longer appears in recipes_list).' }],
        },
      },
      {
        name: 'merge', label: 'Scal duplikaty', permission: 'recipes.merge', destructive: true,
        mcp: {
          description: 'Fold duplicate recipes into a canonical one: favorites and shares move to it and the duplicates redirect (301) to it. The canonical recipe must not be hidden. The result holds merge_id, which recipes_unmerge takes (audit_list has it too).',
          rpc: 'admin_merge_recipes_as', target: 'canonical_id', finish: finishRecipeMerge,
          args: [
            { name: 'canonical_id', param: 'p_canonical', type: 'integer', min: 1, required: true, description: 'The recipe to keep.' },
            { name: 'duplicate_ids', param: 'p_losers', type: 'integer_list', min: 1, minItems: 1, maxItems: 20, required: true, description: 'Ids of the duplicates to fold into it (1-20, distinct, not the canonical one).' },
          ],
        },
      },
      {
        name: 'unmerge', label: 'Cofnij scalenie', permission: 'recipes.merge', destructive: true,
        mcp: {
          description: 'Undo one merge: the duplicates come back under their old ids. A restored duplicate loses its source link when the canonical recipe still holds it.',
          rpc: 'admin_unmerge_as', finish: finishRecipeMerge,
          args: [{ name: 'merge_id', param: 'p_merge', type: 'uuid', required: true, description: 'merge_id from the recipes_merge result or from audit_list.' }],
        },
      },
      {
        name: 'set_taxonomy', label: 'Zmień kategorię i tagi', permission: 'recipes.taxonomy', destructive: false,
        mcp: {
          description: 'Set the category and/or the tags of a recipe. Give at least one. An empty tags list clears the tags.',
          rpc: 'admin_set_taxonomy_as', target: 'recipe_id', finish: finishRecipeSlug,
          args: [
            arg.recipeId,
            { name: 'category', param: 'p_category', type: 'string', maxLength: 40, description: 'Category slug (for example zupy, desery, ciasta). Unknown values are refused. Omit to keep the current one.' },
            { name: 'tags', param: 'p_tags', type: 'string_list', maxItems: MAX_TAGS, maxLength: 40, values: RECIPE_TAGS.map((t) => t.value), description: `The complete new tag list (up to ${MAX_TAGS}, from the closed list). Omit to keep the current tags.` },
          ],
        },
      },
    ],
    mcp: {
      list: {
        description: 'List recipes, hidden ones included, newest first. Search matches title, slug, source link, source author, owner username, or a recipe id.',
        rpc: 'admin_list_recipes_as',
        args: [
          { name: 'query', param: 'p_query', type: 'string', maxLength: 100, description: 'Search text, or a recipe id.' },
          { name: 'filter', param: 'p_filter', type: 'string', values: ['all', 'hidden', 'visible'], description: 'Which recipes to list (default all).' },
          arg.limit(100, 'recipes'),
          { name: 'after_created', param: 'p_after_created', type: 'timestamp', description: 'Paging: created_at of the last row of the previous page.' },
          { name: 'after_id', param: 'p_after_id', type: 'integer', min: 1, description: 'Paging: recipe_id of the last row of the previous page.' },
        ],
      },
      get: { description: 'Get one recipe (hidden ones too).', rpc: 'admin_get_recipe_as', args: [arg.recipeId] },
    },
  },
  {
    name: 'access',
    label: 'Kody dostępu',
    path: '/admin/dostep',
    permission: 'access.manage',
    operations: [
      {
        name: 'create_code', label: 'Utwórz kod', permission: 'access.manage', destructive: false,
        mcp: {
          description: 'Create an access code. The code is generated by the database and appears only in this result; it cannot be read again.',
          rpc: 'admin_create_access_code_as',
          args: [
            { name: 'note', param: 'p_note', type: 'string', maxLength: 200, description: 'Who or what it is for.' },
            { name: 'max_uses', param: 'p_max_uses', type: 'integer', min: 1, max: 1000, description: 'How many times it can be used (default 1).' },
            { name: 'expires_at', param: 'p_expires_at', type: 'timestamp', description: 'ISO 8601 expiry; omit for none.' },
          ],
        },
      },
      {
        name: 'set_full_access', label: 'Zmień pełny dostęp', permission: 'access.manage', destructive: true,
        mcp: {
          description: 'Grant or revoke full access (the paid-feature gate) for one account.',
          rpc: 'admin_set_full_access_as', target: 'user_id',
          args: [arg.userId, { name: 'on', param: 'p_on', type: 'boolean', required: true, description: 'true grants, false revokes.' }],
        },
      },
    ],
    mcp: {
      list: {
        description: 'List access codes with their use counts and state. The codes themselves are never stored, so never shown.',
        rpc: 'admin_list_access_codes_as',
        args: [arg.limit(100, 'codes')],
      },
    },
  },
  {
    name: 'roles',
    label: 'Role',
    path: '/admin/role',
    permission: 'roles.manage',
    operations: [
      {
        name: 'set_role', label: 'Zmień rolę', permission: 'roles.manage', destructive: true,
        mcp: {
          description: 'Grant or remove a staff role on an account. You cannot change your own roles and the last admin cannot be removed.',
          rpc: 'admin_set_role_as', target: 'user_id',
          args: [
            arg.userId,
            { name: 'role', param: 'p_role', type: 'string', maxLength: 32, required: true, description: 'Role name, e.g. admin or moderator.' },
            { name: 'on', param: 'p_on', type: 'boolean', required: true, description: 'true grants, false removes.' },
          ],
        },
      },
    ],
    mcp: {
      list: { description: 'List the accounts that hold a staff role, with their roles.', rpc: 'admin_list_staff_as', args: [] },
    },
  },
  {
    name: 'audit',
    label: 'Dziennik zmian',
    path: '/admin/dziennik',
    permission: 'audit.read',
    operations: [],
    mcp: {
      list: {
        description: 'List audit log rows, newest first. via is panel or mcp; calls that were refused or only previewed carry after.outcome.',
        rpc: 'admin_list_audit_as',
        args: [
          { name: 'resource', param: 'p_resource', type: 'string', maxLength: 40, description: 'Only this resource (users, imports, access, roles, tokens...).' },
          { name: 'actor_id', param: 'p_filter_actor', type: 'uuid', description: 'Only changes made by this account.' },
          { name: 'from', param: 'p_from', type: 'timestamp', description: 'ISO 8601 lower bound.' },
          { name: 'to', param: 'p_to', type: 'timestamp', description: 'ISO 8601 upper bound.' },
          arg.limit(100, 'rows'),
          arg.beforeId,
        ],
      },
    },
  },
]

/** The resources this staff member may open, in navigation order. */
export function visibleResources(permissions: ReadonlySet<StaffPermission>): StaffResource[] {
  return STAFF_RESOURCES.filter((r) => permissions.has(r.permission))
}

/** Whether `permissions` allow `operation` (the panel shows its button only then). */
export function canRun(permissions: ReadonlySet<StaffPermission>, operation: StaffOperation): boolean {
  return permissions.has(operation.permission)
}
