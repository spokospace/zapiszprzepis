-- Staff MCP: full control over a recipe's content (recipes_update, richer recipes_get).
--
-- Until now staff could change only the SEO title, category and tags of a recipe. A wrong
-- extraction (a blog post that holds two recipes, one of them a prose paragraph, with the
-- cover of the other) could not be fixed without touching the database by hand.
--
-- admin_update_recipe_content_as edits title, description (the short variant line),
-- meta_description, servings, the three times, source_author, ingredients, steps, step_images
-- and image_url. NULL leaves a field as it is; an empty string clears a text field. Any
-- change sets content_locked_at, and the extraction refresh then keeps the content as it is
-- (same idea as taxonomy_locked_at, #689). Every change is audited with the fields' old and
-- new values and bumps updated_at / content_version through the usual triggers.
--
-- step_images is index-aligned with steps: when the number of steps changes and no new
-- step_images is given, the photos are dropped (they would point at the wrong steps).
--
-- admin_get_recipe_content_as returns the recipe row staff already see plus the content
-- columns, as one jsonb object (what recipes_get serves).
--
-- Requires 20261029100000 (staff_can, staff_audit, admin_recipe_rows) and 20261107100000.
-- Apply to production only with the owner's go. Idempotent: safe to re-run.
--
-- Rollback (manual): drop function public.admin_update_recipe_content_as(uuid, bigint, text,
-- text, text, integer, integer, integer, integer, text, jsonb, text[], text[], text, text, bigint);
-- drop function public.admin_get_recipe_content_as(uuid, bigint);
-- alter table public.recipes drop column if exists content_locked_at;

alter table public.recipes
  add column if not exists content_locked_at timestamptz;

comment on column public.recipes.content_locked_at is
  'Set when staff edited the recipe content by hand (recipes_update). While set, the extraction refresh keeps title, description, ingredients, steps, times and servings as they are.';

-- ── Read ────────────────────────────────────────────────────────────────────

create or replace function public.admin_get_recipe_content_as(p_actor uuid, p_recipe bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base jsonb;
  rec public.recipes%rowtype;
begin
  select to_jsonb(r) into base from public.admin_recipe_rows(p_actor, null, 'all', p_recipe, 1, null, null) r;
  if base is null then
    return null;
  end if;
  select * into rec from public.recipes where id = p_recipe;
  return base || jsonb_build_object(
    'description', rec.description,
    'meta_description', rec.meta_description,
    'meta_title', rec.meta_title,
    'servings', rec.servings,
    'prep_time_minutes', rec.prep_time_minutes,
    'cook_time_minutes', rec.cook_time_minutes,
    'total_time_minutes', rec.total_time_minutes,
    'source_author', rec.source_author,
    'ingredients', rec.ingredients,
    'steps', rec.steps,
    'step_images', to_jsonb(rec.step_images),
    'tags', to_jsonb(rec.tags),
    'content_locked_at', rec.content_locked_at
  );
end;
$$;

-- ── Write ───────────────────────────────────────────────────────────────────

create or replace function public.admin_update_recipe_content_as(
  p_actor uuid,
  p_recipe bigint,
  p_title text default null,
  p_description text default null,
  p_meta_description text default null,
  p_servings integer default null,
  p_prep integer default null,
  p_cook integer default null,
  p_total integer default null,
  p_source_author text default null,
  p_ingredients jsonb default null,
  p_steps text[] default null,
  p_step_images text[] default null,
  p_image_url text default null,
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
  v_title text := case when p_title is null then null else btrim(p_title) end;
  v_desc text := case when p_description is null then null else nullif(btrim(p_description), '') end;
  v_meta text := case when p_meta_description is null then null else nullif(btrim(p_meta_description), '') end;
  v_author text := case when p_source_author is null then null else nullif(btrim(p_source_author), '') end;
  v_image text := case when p_image_url is null then null else nullif(btrim(p_image_url), '') end;
  -- The cover and step photos must already be archived on our image host (no hotlinking).
  image_re constant text := '^https://img\.zapiszprzepis\.pl/[^\s]+$';
  new_steps jsonb;
  new_step_images text[];
  v_times_changed boolean := p_prep is not null or p_cook is not null or p_total is not null;
  item jsonb;
  k text;
  before_v jsonb := '{}'::jsonb;
  after_v jsonb := '{}'::jsonb;
begin
  if not public.staff_can(p_actor, 'recipes.edit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_title is null and p_description is null and p_meta_description is null and p_servings is null
     and p_prep is null and p_cook is null and p_total is null and p_source_author is null
     and p_ingredients is null and p_steps is null and p_step_images is null and p_image_url is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if v_title is not null and char_length(v_title) not between 1 and 200 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if char_length(v_desc) > 300 or char_length(v_meta) > 400 or char_length(v_author) > 200 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_servings is not null and p_servings not between 1 and 99 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if (p_prep is not null and p_prep not between 0 and 10000)
     or (p_cook is not null and p_cook not between 0 and 10000)
     or (p_total is not null and p_total not between 0 and 10000) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if v_image is not null and (v_image !~ image_re or char_length(v_image) > 500) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if p_ingredients is not null then
    if jsonb_typeof(p_ingredients) <> 'array' or jsonb_array_length(p_ingredients) not between 1 and 100 then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    for item in select value from jsonb_array_elements(p_ingredients) loop
      if jsonb_typeof(item) <> 'object'
         or jsonb_typeof(item -> 'name') is distinct from 'string'
         or btrim(item ->> 'name') = ''
         or char_length(item ->> 'name') > 200 then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
      for k in select key from jsonb_each(item) loop
        if k not in ('name', 'amount', 'unit', 'alt', 'section')
           or jsonb_typeof(item -> k) <> 'string'
           or char_length(item ->> k) > 200 then
          raise exception 'invalid_input' using errcode = '22023';
        end if;
      end loop;
    end loop;
  end if;

  if p_steps is not null then
    if cardinality(p_steps) not between 1 and 100
       or exists (select 1 from unnest(p_steps) s where s is null or btrim(s) = '' or char_length(s) > 3000) then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
  end if;

  select * into rec from public.recipes where id = p_recipe for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  new_steps := case when p_steps is null then rec.steps else to_jsonb(p_steps) end;
  new_step_images := rec.step_images;
  if p_step_images is not null then
    if cardinality(p_step_images) > jsonb_array_length(new_steps)
       or exists (select 1 from unnest(p_step_images) s
                  where s is null or char_length(s) > 500 or (s <> '' and s !~ image_re)) then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    new_step_images := p_step_images;
  elsif p_steps is not null and cardinality(p_steps) <> jsonb_array_length(rec.steps) then
    new_step_images := '{}';
  end if;

  update public.recipes
  set title = coalesce(v_title, title),
      description = case when p_description is null then description else v_desc end,
      meta_description = case when p_meta_description is null then meta_description else v_meta end,
      servings = coalesce(p_servings, servings),
      prep_time_minutes = coalesce(p_prep, prep_time_minutes),
      cook_time_minutes = coalesce(p_cook, cook_time_minutes),
      total_time_minutes = coalesce(p_total, total_time_minutes),
      times_estimated = case when v_times_changed then false else times_estimated end,
      source_author = case when p_source_author is null then source_author else v_author end,
      ingredients = coalesce(p_ingredients, ingredients),
      -- The stored fingerprint describes the old list; a missing one is backfilled by the importer.
      ingredient_fingerprint = case when p_ingredients is null then ingredient_fingerprint else null end,
      steps = new_steps,
      step_images = new_step_images,
      image_url = case when p_image_url is null then image_url else v_image end,
      content_locked_at = now()
  where id = p_recipe;

  if v_title is not null then
    before_v := before_v || jsonb_build_object('title', rec.title);
    after_v := after_v || jsonb_build_object('title', v_title);
  end if;
  if p_description is not null then
    before_v := before_v || jsonb_build_object('description', rec.description);
    after_v := after_v || jsonb_build_object('description', v_desc);
  end if;
  if p_meta_description is not null then
    before_v := before_v || jsonb_build_object('meta_description', rec.meta_description);
    after_v := after_v || jsonb_build_object('meta_description', v_meta);
  end if;
  if p_servings is not null then
    before_v := before_v || jsonb_build_object('servings', rec.servings);
    after_v := after_v || jsonb_build_object('servings', p_servings);
  end if;
  if v_times_changed then
    before_v := before_v || jsonb_build_object('prep', rec.prep_time_minutes, 'cook', rec.cook_time_minutes, 'total', rec.total_time_minutes);
    after_v := after_v || jsonb_build_object('prep', coalesce(p_prep, rec.prep_time_minutes), 'cook', coalesce(p_cook, rec.cook_time_minutes), 'total', coalesce(p_total, rec.total_time_minutes));
  end if;
  if p_source_author is not null then
    before_v := before_v || jsonb_build_object('source_author', rec.source_author);
    after_v := after_v || jsonb_build_object('source_author', v_author);
  end if;
  if p_ingredients is not null then
    before_v := before_v || jsonb_build_object('ingredients', rec.ingredients);
    after_v := after_v || jsonb_build_object('ingredients', p_ingredients);
  end if;
  if p_steps is not null then
    before_v := before_v || jsonb_build_object('steps', rec.steps);
    after_v := after_v || jsonb_build_object('steps', new_steps);
  end if;
  if new_step_images is distinct from rec.step_images then
    before_v := before_v || jsonb_build_object('step_images', to_jsonb(rec.step_images));
    after_v := after_v || jsonb_build_object('step_images', to_jsonb(new_step_images));
  end if;
  if p_image_url is not null then
    before_v := before_v || jsonb_build_object('image_url', rec.image_url);
    after_v := after_v || jsonb_build_object('image_url', v_image);
  end if;

  perform public.staff_audit(p_actor, p_via, p_token_id, 'recipes', 'update', p_recipe::text, before_v, after_v);
  return rec.slug;
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.admin_get_recipe_content_as(uuid, bigint) from public, anon, authenticated;
revoke all on function public.admin_update_recipe_content_as(uuid, bigint, text, text, text, integer, integer, integer, integer, text, jsonb, text[], text[], text, text, bigint) from public, anon, authenticated;
grant execute on function public.admin_get_recipe_content_as(uuid, bigint) to service_role;
grant execute on function public.admin_update_recipe_content_as(uuid, bigint, text, text, text, integer, integer, integer, integer, text, jsonb, text[], text[], text, text, bigint) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.admin_update_recipe_content_as(uuid,bigint,text,text,text,integer,integer,integer,integer,text,jsonb,text[],text[],text,text,bigint)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_update_recipe_content_as(uuid,bigint,text,text,text,integer,integer,integer,integer,text,jsonb,text[],text[],text,text,bigint)', 'execute')
     or has_function_privilege('anon', 'public.admin_get_recipe_content_as(uuid,bigint)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_get_recipe_content_as(uuid,bigint)', 'execute') then
    raise exception 'admin recipe content functions are executable by an API role';
  end if;
end $$;
