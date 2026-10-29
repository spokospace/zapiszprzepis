-- Admin panel, Phase 2 — fixing a recipe's category and tags.
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (API Contracts, Recipes)
--
-- The category is the recipe_category enum, so the database rejects a value that does
-- not exist. The tag list is closed in the app (src/lib/recipe-tags.ts), not in SQL, so
-- the app validates against it BEFORE calling; this function only keeps the shape sane
-- (lower-case ASCII slugs, distinct, at most 6 like MAX_TAGS) so a direct call cannot
-- store free text. A NULL argument leaves that field as it is; an empty tag array clears
-- the tags.
--
-- The change goes through the same row update the importer uses, so updated_at (and the
-- sitemap lastmod) move with it. Returns the slug for cache invalidation.
--
-- Requires 20261029100000. Applied only with the owner's explicit go (local development
-- points at the production database).
--
-- Idempotent: safe to re-run.

create or replace function public.admin_set_taxonomy_as(
  p_actor uuid,
  p_recipe bigint,
  p_category text default null,
  p_tags text[] default null,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.recipes%rowtype;
  new_category public.recipe_category;
begin
  if not public.staff_can(p_actor, 'recipes.taxonomy') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_category is null and p_tags is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_tags is not null then
    if cardinality(p_tags) > 6
       or exists (select 1 from unnest(p_tags) as t where t is null or t !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(t) > 40)
       or (select count(distinct t) from unnest(p_tags) as t) <> cardinality(p_tags) then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
  end if;
  if p_category is not null then
    begin
      new_category := p_category::public.recipe_category;
    exception when invalid_text_representation then
      raise exception 'invalid_input' using errcode = '22023';
    end;
  end if;

  select * into rec from public.recipes where id = p_recipe for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.recipes
  set category = coalesce(new_category, category),
      tags = coalesce(p_tags, tags)
  where id = p_recipe;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'recipes', 'set_taxonomy', p_recipe::text,
    jsonb_build_object('category', rec.category, 'tags', to_jsonb(rec.tags)),
    jsonb_build_object('category', coalesce(new_category, rec.category), 'tags', to_jsonb(coalesce(p_tags, rec.tags)))
  );
  return rec.slug;
end;
$$;

-- ── Panel wrapper (the caller's own session) ────────────────────────────────

create or replace function public.admin_set_taxonomy(p_recipe bigint, p_category text default null, p_tags text[] default null)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.admin_set_taxonomy_as(auth.uid(), p_recipe, p_category, p_tags, 'panel', null)
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.admin_set_taxonomy_as(uuid, bigint, text, text[], text, bigint) from public, anon, authenticated;
revoke all on function public.admin_set_taxonomy(bigint, text, text[]) from public, anon, authenticated;
grant execute on function public.admin_set_taxonomy_as(uuid, bigint, text, text[], text, bigint) to service_role;
grant execute on function public.admin_set_taxonomy(bigint, text, text[]) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_admin_recipe_taxonomy_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if has_function_privilege('anon', 'public.admin_set_taxonomy_as(uuid,bigint,text,text[],text,bigint)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_set_taxonomy_as(uuid,bigint,text,text[],text,bigint)', 'execute') then
    raise exception 'admin recipe taxonomy grant check: admin_set_taxonomy_as is executable by an API role';
  end if;
  if has_function_privilege('anon', 'public.admin_set_taxonomy(bigint,text,text[])', 'execute') then
    raise exception 'admin recipe taxonomy grant check: anon can execute admin_set_taxonomy';
  end if;
end;
$$;

revoke all on function public.assert_admin_recipe_taxonomy_grants() from public, anon, authenticated;

select public.assert_admin_recipe_taxonomy_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_admin_recipe_taxonomy_grants(), public.admin_set_taxonomy(bigint, text, text[]),
--   public.admin_set_taxonomy_as(uuid, bigint, text, text[], text, bigint);
