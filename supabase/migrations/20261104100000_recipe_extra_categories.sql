-- Recipes in multiple categories (issue #689), slice 1: data model, queries, lock.
-- Spec: .ai/specs/2026-11-04-multi-category-recipes.md (PR #690)
--
-- recipes.category stays the PRIMARY category (URL, breadcrumbs, OG, "Podobne").
-- recipes.extra_categories (at most 2) puts the dish in more category LISTS too. Every
-- reader that counts or lists "recipes in category X" now asks
--   category = X OR extra_categories @> array[X]
-- recipes.taxonomy_locked_at is set by every manual taxonomy edit; the re-extraction
-- refresh path skips category / tags / extra_categories while it is set.
--
-- What this migration changes:
--   * recipes: extra_categories, taxonomy_locked_at, a CHECK (<= 2, no NULLs, no
--     repeats, primary not among them) and a GIN index.
--   * public_recipes: one new TRAILING column, extra_categories (guarded re-creation;
--     the hidden_at filter stays, assert_public_view_boundary keeps passing).
--     taxonomy_locked_at is NOT exposed.
--   * category_tag_facets, recipe_category_context: membership predicate.
--   * search_recipes: also returns extra_categories (the app narrows by category and
--     counts the category facets from it). Return type changes, so it is dropped and
--     re-created in this transaction.
--   * admin_usage_summary_as: recipes-per-category counts extras too.
--   * admin_set_taxonomy_as / admin_set_taxonomy: new trailing p_extra_categories
--     (null = leave, '{}' = clear). The old signatures are dropped so PostgREST has one
--     candidate; callers that omit the argument behave as before, apart from the lock.
--
-- Order: apply THIS migration BEFORE deploying the app that reads extra_categories.
-- The old app keeps working against the new schema (everything is additive).
-- Applied only with the owner's explicit go (local development points at the
-- production database). See .ai/runs/2026-11-04-multi-category-recipes/APPLY.md.
--
-- Idempotent: safe to re-run.

-- ── Columns, constraint, index ──────────────────────────────────────────────

alter table public.recipes
  add column if not exists extra_categories public.recipe_category[] not null default '{}',
  add column if not exists taxonomy_locked_at timestamptz;

comment on column public.recipes.extra_categories is
  'Further category lists the dish appears in (max 2, not the primary). category stays the primary.';
comment on column public.recipes.taxonomy_locked_at is
  'Set by every manual taxonomy edit (admin panel / MCP). While set, re-extraction does not touch category, tags or extra_categories. Never exposed by public_recipes.';

-- A CHECK cannot hold a subquery, so the rules live in an immutable function.
create or replace function public.recipe_extra_categories_valid(
  p_primary public.recipe_category,
  p_extras public.recipe_category[]
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_extras is not null
     and cardinality(p_extras) <= 2
     and array_position(p_extras, null::public.recipe_category) is null
     and not (p_primary = any (p_extras))
     and (cardinality(p_extras) < 2 or p_extras[1] <> p_extras[2])
$$;

do $$
begin
  alter table public.recipes
    add constraint recipes_extra_categories_valid
    check (public.recipe_extra_categories_valid(category, extra_categories));
exception when duplicate_object then null;
end $$;

create index if not exists idx_recipes_extra_categories
  on public.recipes using gin (extra_categories);

-- ── public_recipes: extra_categories as the last column ─────────────────────

do $view$
declare
  cols text[];
  n int;
begin
  -- Column-order-drift guard: restates the view as 20261029100000 leaves it
  -- (step_images last). Already extended (re-run): nothing to do.
  select array_agg(column_name::text order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';
  n := array_length(cols, 1);
  if n is not null and cols[n] = 'extra_categories' then
    return;
  end if;
  if n is null or cols[n] <> 'step_images' then
    raise exception 'public_recipes last column is [%], expected step_images — refusing to re-create',
      coalesce(cols[n], '<none>');
  end if;

  execute $sql$
    create or replace view public.public_recipes
    with (security_invoker = false)
    as
    select
      r.id,
      r.slug,
      r.title,
      r.description,
      r.image_url,
      r.category,
      r.tags,
      r.prep_time_minutes,
      r.cook_time_minutes,
      r.total_time_minutes,
      r.ingredients,
      r.steps,
      r.source_type,
      r.source_url,
      r.source_author,
      r.times_estimated,
      r.youtube_id,
      r.created_at,
      p.display_name as author_name,
      r.meta_description,
      p.username as author_username,
      coalesce(cardinality(r.image_urls), 0) as gallery_count,
      r.servings,
      null::text as author_gender_form,
      r.dish,
      r.dish_accusative,
      r.variant_note,
      coalesce(r.updated_at, r.created_at) as last_modified,
      r.step_images,
      r.extra_categories
    from public.recipes r
    left join public.profiles p on p.id = r.user_id
    where r.hidden_at is null
  $sql$;
end
$view$;

comment on view public.public_recipes is
  'Guest-safe read of every visible recipe (E01). No user_id, no gallery URLs (count only), '
  'nothing about the author''s gender (author_gender_form is always null, #376), the '
  'dish grouping key, its accusative, the variant note (E01-S21), last_modified for '
  'sitemap <lastmod>, step_images (per-step photos, public like steps) and '
  'extra_categories (#689). Recipes hidden by staff (hidden_at) are not in it. Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;

select public.assert_public_view_boundary();

-- ── category_tag_facets: membership ─────────────────────────────────────────

create or replace function public.category_tag_facets(
  p_category public.recipe_category,
  p_selected text[] default '{}'
)
returns table (tag text, count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.tag, count(*)::bigint
  from public.public_recipes v
  -- Distinct per row: a tag listed twice on one recipe must count once, mirroring
  -- the client-side `new Set(row.tags)`.
  cross join lateral (select distinct x from unnest(v.tags) as x) t(tag)
  where (v.category = p_category or v.extra_categories @> array[p_category])
    and v.tags @> coalesce(p_selected, '{}'::text[])
  group by t.tag
$$;

-- ── recipe_category_context: the list bar walks the primary's whole list ────

create or replace function public.recipe_category_context(p_id bigint)
returns table (
  category public.recipe_category,
  total integer,
  idx integer,
  prev jsonb,
  next jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_category public.recipe_category;
  v_created timestamptz;
begin
  select v.category, v.created_at
    into v_category, v_created
    from public.public_recipes v
    where v.id = p_id;

  if not found then
    return;
  end if;

  return query
    select
      v_category,
      (select count(*)
         from public.public_recipes v
         where (v.category = v_category or v.extra_categories @> array[v_category]))::int,
      (select count(*)
         from public.public_recipes v
         where (v.category = v_category or v.extra_categories @> array[v_category])
           and (v.created_at > v_created or (v.created_at = v_created and v.id > p_id)))::int + 1,
      (select to_jsonb(n)
         from (
           select v.slug, v.title
             from public.public_recipes v
             where (v.category = v_category or v.extra_categories @> array[v_category])
               and (v.created_at > v_created or (v.created_at = v_created and v.id > p_id))
             order by v.created_at asc, v.id asc
             limit 1
         ) n),
      (select to_jsonb(o)
         from (
           select v.slug, v.title
             from public.public_recipes v
             where (v.category = v_category or v.extra_categories @> array[v_category])
               and (v.created_at < v_created or (v.created_at = v_created and v.id < p_id))
             order by v.created_at desc, v.id desc
             limit 1
         ) o);
end;
$$;

-- ── search_recipes: also returns extra_categories ───────────────────────────

drop function if exists public.search_recipes(text, text, integer);

create or replace function public.search_recipes(
  p_query text,
  p_scope text default 'all',
  p_limit integer default 14
)
returns table (
  id bigint,
  slug text,
  title text,
  image_url text,
  category public.recipe_category,
  extra_categories public.recipe_category[],
  description text,
  source_type public.recipe_source,
  source_url text,
  source_author text,
  total_time_minutes integer,
  prep_time_minutes integer,
  cook_time_minutes integer,
  created_at timestamp with time zone,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_patterns text[];
  v_limit integer := least(greatest(coalesce(p_limit, 14), 1), 140);
  v_user uuid := public.current_user_id();
begin
  if p_scope is null or p_scope not in ('all', 'mine', 'fav') then
    raise exception 'search_recipes: unknown scope %', p_scope using errcode = '22023';
  end if;

  -- Up to 5 words of up to 50 chars; LIKE wildcards and the escape char are literal.
  select array_agg(
           '%' || replace(replace(replace(left(w, 50), '\', '\\'), '%', '\%'), '_', '\_') || '%'
           order by ord
         )
    into v_patterns
    from (
      select w, ord
      from regexp_split_to_table(lower(btrim(coalesce(p_query, ''))), '\s+') with ordinality as t(w, ord)
      where w <> ''
      order by ord
      limit 5
    ) words;

  if v_patterns is null then
    return;
  end if;

  if p_scope <> 'all' and v_user is null then
    return;
  end if;

  if p_scope = 'all' then
    return query
      select v.id, v.slug, v.title, v.image_url, v.category, v.extra_categories, v.description, v.source_type,
             v.source_url, v.source_author, v.total_time_minutes, v.prep_time_minutes,
             v.cook_time_minutes, v.created_at, count(*) over ()
      from public.public_recipes v
      where public.recipe_search_text(v.title, v.ingredients) like v_patterns[1]
        and public.recipe_search_text(v.title, v.ingredients) like all (v_patterns)
      order by lower(v.title) like all (v_patterns) desc, v.created_at desc, v.id desc
      limit v_limit;
  elsif p_scope = 'mine' then
    return query
      select v.id, v.slug, v.title, v.image_url, v.category, v.extra_categories, v.description, v.source_type,
             v.source_url, v.source_author, v.total_time_minutes, v.prep_time_minutes,
             v.cook_time_minutes, v.created_at, count(*) over ()
      from public.public_recipes v
      where public.recipe_search_text(v.title, v.ingredients) like v_patterns[1]
        and public.recipe_search_text(v.title, v.ingredients) like all (v_patterns)
        and exists (select 1 from public.recipes r where r.id = v.id and r.user_id = v_user)
      order by lower(v.title) like all (v_patterns) desc, v.created_at desc, v.id desc
      limit v_limit;
  else
    return query
      select v.id, v.slug, v.title, v.image_url, v.category, v.extra_categories, v.description, v.source_type,
             v.source_url, v.source_author, v.total_time_minutes, v.prep_time_minutes,
             v.cook_time_minutes, v.created_at, count(*) over ()
      from public.public_recipes v
      where public.recipe_search_text(v.title, v.ingredients) like v_patterns[1]
        and public.recipe_search_text(v.title, v.ingredients) like all (v_patterns)
        and exists (select 1 from public.favorites f where f.recipe_id = v.id and f.user_id = v_user)
      order by lower(v.title) like all (v_patterns) desc, v.created_at desc, v.id desc
      limit v_limit;
  end if;
end;
$$;


comment on function public.search_recipes(text, text, integer) is
  'The one recipe search (E01-S05): scope all | mine | fav, every word must match title or an ingredient name. Rows carry extra_categories (#689) for the category filter.';

revoke all on function public.search_recipes(text, text, integer) from public;
grant execute on function public.search_recipes(text, text, integer) to anon, authenticated;

-- ── admin_usage_summary_as: recipes per category count extras ───────────────

create or replace function public.admin_usage_summary_as(p_actor uuid, p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := greatest(1, least(coalesce(p_days, 7), 366));
  since date;
begin
  if not public.staff_can(p_actor, 'analytics.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  since := (now() at time zone 'Europe/Warsaw')::date - (n - 1);

  return jsonb_build_object(
    'days', n,
    'since', since,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('subject', c.subject, 'views', c.views, 'recipes', coalesce(r.recipes, 0))
                       order by c.views desc, c.subject)
      from (
        select subject, sum(count)::bigint as views
        from public.usage_counters
        where event = 'category_view' and day >= since
        group by subject
      ) c
      left join (
        select m.subject, count(*)::bigint as recipes
        from (
          select category::text as subject from public.public_recipes
          union all
          select x::text from public.public_recipes, unnest(extra_categories) as x
        ) m
        group by m.subject
      ) r on r.subject = c.subject
    ), '[]'::jsonb),
    'recipes', coalesce((
      select jsonb_agg(jsonb_build_object('slug', t.slug, 'title', t.title, 'views', t.views)
                       order by t.views desc, t.slug)
      from (
        select p.slug, p.title, sum(u.count)::bigint as views
        from public.usage_counters u
        join public.public_recipes p on p.slug = u.subject
        where u.event = 'recipe_view' and u.day >= since
        group by p.slug, p.title
        order by sum(u.count) desc, p.slug
        limit 20
      ) t
    ), '[]'::jsonb),
    'orphan_views', coalesce((
      select sum(u.count)::bigint
      from public.usage_counters u
      where u.event = 'recipe_view' and u.day >= since
        and not exists (select 1 from public.public_recipes p where p.slug = u.subject)
    ), 0),
    'features', coalesce((
      select jsonb_agg(jsonb_build_object('event', f.event, 'count', f.total) order by f.event)
      from (
        select event, sum(count)::bigint as total
        from public.usage_counters
        where event in ('timer_start', 'print', 'favorite_add') and day >= since
        group by event
      ) f
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'event', d.event, 'count', d.total) order by d.day, d.event)
      from (
        select day, event, sum(count)::bigint as total
        from public.usage_counters
        where day >= since
        group by day, event
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

-- ── Taxonomy edit: extras + the lock ────────────────────────────────────────

-- The old signatures go: with a trailing defaulted argument both would be candidates
-- for a call that omits it, and PostgREST refuses to choose.
drop function if exists public.admin_set_taxonomy(bigint, text, text[]);
drop function if exists public.admin_set_taxonomy_as(uuid, bigint, text, text[], text, bigint);

create or replace function public.admin_set_taxonomy_as(
  p_actor uuid,
  p_recipe bigint,
  p_category text default null,
  p_tags text[] default null,
  p_via text default 'panel',
  p_token_id bigint default null,
  p_extra_categories text[] default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.recipes%rowtype;
  new_category public.recipe_category;
  new_extras public.recipe_category[];
  eff_primary public.recipe_category;
  eff_extras public.recipe_category[];
begin
  if not public.staff_can(p_actor, 'recipes.taxonomy') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_category is null and p_tags is null and p_extra_categories is null then
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
  if p_extra_categories is not null then
    if cardinality(p_extra_categories) > 2
       or exists (select 1 from unnest(p_extra_categories) as c where c is null)
       or (select count(distinct c) from unnest(p_extra_categories) as c) <> cardinality(p_extra_categories) then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    begin
      new_extras := p_extra_categories::public.recipe_category[];
    exception when invalid_text_representation then
      raise exception 'invalid_input' using errcode = '22023';
    end;
  end if;

  select * into rec from public.recipes where id = p_recipe for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  eff_primary := coalesce(new_category, rec.category);
  -- Explicit extras win (and may not repeat the primary); otherwise the stored ones
  -- stay, minus the new primary, so the constraint never fails mid-edit.
  if new_extras is not null then
    if eff_primary = any (new_extras) then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    eff_extras := new_extras;
  else
    eff_extras := array_remove(rec.extra_categories, eff_primary);
  end if;

  update public.recipes
  set category = eff_primary,
      tags = coalesce(p_tags, tags),
      extra_categories = eff_extras,
      taxonomy_locked_at = now()
  where id = p_recipe;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'recipes', 'set_taxonomy', p_recipe::text,
    jsonb_build_object('category', rec.category, 'tags', to_jsonb(rec.tags), 'extra_categories', to_jsonb(rec.extra_categories)),
    jsonb_build_object('category', eff_primary, 'tags', to_jsonb(coalesce(p_tags, rec.tags)), 'extra_categories', to_jsonb(eff_extras))
  );
  return rec.slug;
end;
$$;

create or replace function public.admin_set_taxonomy(
  p_recipe bigint,
  p_category text default null,
  p_tags text[] default null,
  p_extra_categories text[] default null
)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.admin_set_taxonomy_as(auth.uid(), p_recipe, p_category, p_tags, 'panel', null, p_extra_categories)
$$;

revoke all on function public.admin_set_taxonomy_as(uuid, bigint, text, text[], text, bigint, text[]) from public, anon, authenticated;
revoke all on function public.admin_set_taxonomy(bigint, text, text[], text[]) from public, anon, authenticated;
grant execute on function public.admin_set_taxonomy_as(uuid, bigint, text, text[], text, bigint, text[]) to service_role;
grant execute on function public.admin_set_taxonomy(bigint, text, text[], text[]) to authenticated;

create or replace function public.assert_admin_recipe_taxonomy_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if has_function_privilege('anon', 'public.admin_set_taxonomy_as(uuid,bigint,text,text[],text,bigint,text[])', 'execute')
     or has_function_privilege('authenticated', 'public.admin_set_taxonomy_as(uuid,bigint,text,text[],text,bigint,text[])', 'execute') then
    raise exception 'admin recipe taxonomy grant check: admin_set_taxonomy_as is executable by an API role';
  end if;
  if has_function_privilege('anon', 'public.admin_set_taxonomy(bigint,text,text[],text[])', 'execute') then
    raise exception 'admin recipe taxonomy grant check: anon can execute admin_set_taxonomy';
  end if;
end;
$$;

revoke all on function public.assert_admin_recipe_taxonomy_grants() from public, anon, authenticated;

select public.assert_admin_recipe_taxonomy_grants();
select public.assert_admin_usage_grants();

-- ── Smoke (read-only): the constraint accepts the empty default ─────────────
do $$
begin
  if not public.recipe_extra_categories_valid('inne', '{}') then
    raise exception 'recipe_extra_categories_valid rejects the empty set';
  end if;
  if public.recipe_extra_categories_valid('inne', array['inne']::public.recipe_category[]) then
    raise exception 'recipe_extra_categories_valid accepts the primary';
  end if;
end $$;

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop view public.public_recipes; then restore the previous definitions by re-running, in
-- order: 20261029100000 (view and boundary), 20261021110000, 20261024120000, 20261017160000 (drop search_recipes
-- first), 20261103100000 (usage) and 20261029130000 (after dropping the 7-arg
-- admin_set_taxonomy_as and the 4-arg admin_set_taxonomy). Then:
--   alter table public.recipes drop constraint if exists recipes_extra_categories_valid;
--   drop index if exists public.idx_recipes_extra_categories;
--   alter table public.recipes drop column if exists extra_categories, drop column if exists taxonomy_locked_at;
--   drop function if exists public.recipe_extra_categories_valid(public.recipe_category, public.recipe_category[]);
