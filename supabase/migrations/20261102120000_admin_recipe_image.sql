-- The staff recipe list shows each recipe's thumbnail, so the admin row carries image_url.
-- Adds the column to the composite type and redefines admin_recipe_rows to select it; the
-- wrappers (admin_list_recipes_as, admin_get_recipe_as, admin_list_recipes) read the type,
-- so they pick the column up without changes. image_url is only ever a Supabase Storage URL
-- or null (see run-extract-recipe.ts), so exposing it to staff leaks nothing new.

-- ALTER TYPE ... ADD ATTRIBUTE has no IF NOT EXISTS, so guard it to keep the file re-runnable.
do $$
begin
  if not exists (
    select 1 from information_schema.attributes
    where udt_schema = 'public' and udt_name = 'admin_recipe_row' and attribute_name = 'image_url'
  ) then
    alter type public.admin_recipe_row add attribute image_url text;
  end if;
end $$;

-- Same body as 20261029100000_admin_recipe_hiding.sql, plus r.image_url as the last column.
create or replace function public.admin_recipe_rows(
  p_actor uuid,
  p_query text,
  p_filter text,
  p_recipe bigint,
  p_limit integer,
  p_after_created timestamp with time zone,
  p_after_id bigint
)
returns setof public.admin_recipe_row
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  q text := nullif(btrim(coalesce(p_query, '')), '');
  q_id bigint;
  f text := coalesce(p_filter, 'all');
begin
  if not public.staff_can(p_actor, 'recipes.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if f not in ('all', 'hidden', 'visible') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if q is not null then
    if q ~ '^[0-9]{1,18}$' then
      q_id := q::bigint;
    end if;
    q := '%' || regexp_replace(q, '([\\%_])', '\\\1', 'g') || '%';
  end if;

  return query
    select
      r.id,
      r.slug,
      r.title,
      r.category::text,
      r.source_type::text,
      r.source_url,
      r.user_id,
      p.username,
      r.created_at,
      r.updated_at,
      r.hidden_at,
      r.hidden_reason,
      (select count(*) from public.favorites fv where fv.recipe_id = r.id),
      r.image_url
    from public.recipes r
    left join public.profiles p on p.id = r.user_id
    where (p_recipe is null or r.id = p_recipe)
      and (f = 'all' or (f = 'hidden' and r.hidden_at is not null) or (f = 'visible' and r.hidden_at is null))
      and (q is null
           or r.id = q_id
           or r.title ilike q
           or r.slug ilike q
           or r.source_url ilike q
           or r.source_author ilike q
           or p.username ilike q)
      and (p_after_created is null or (r.created_at, r.id) < (p_after_created, p_after_id))
    order by r.created_at desc, r.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;
