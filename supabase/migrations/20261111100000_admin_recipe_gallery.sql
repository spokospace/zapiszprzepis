-- Staff MCP: add photos to a recipe's gallery (recipes_add_gallery_images).
--
-- A recipe imported from a post can miss the photos its linked blog has. Staff could not
-- add them without uploading files to R2 and editing image_urls by hand (#766, recipe 293).
-- The MCP tool downloads and stores the photos in the Worker (src/lib/staff/recipe-gallery.ts)
-- and calls admin_add_gallery_images_as with the stored URLs, which appends them and audits
-- the change in one transaction.
--
-- The gallery keeps its shape from the import: when it holds more than the cover, the cover
-- is its first entry. So an empty gallery starts with the current cover, and the cover
-- itself never changes here. A URL already in the gallery is not added twice. At most 30 entries;
-- when the function refuses, the tool removes the files it stored for the call.
--
-- admin_get_recipe_content_as also returns `gallery` (image_urls), so staff can see the gallery
-- through recipes_get. Additive: one more key.
--
-- Requires 20261110100000_admin_recipe_content. Apply to production only with the owner's
-- go. Idempotent: safe to re-run.
--
-- Rollback (manual): drop function public.admin_add_gallery_images_as(uuid, bigint, text[],
-- text, bigint); re-run the admin_get_recipe_content_as block of 20261110100000.

-- ── Read: recipes_get gains the gallery ─────────────────────────────────────

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
    'gallery', to_jsonb(coalesce(rec.image_urls, '{}')),
    'tags', to_jsonb(rec.tags),
    'content_locked_at', rec.content_locked_at
  );
end;
$$;

-- ── Write ───────────────────────────────────────────────────────────────────

create or replace function public.admin_add_gallery_images_as(
  p_actor uuid,
  p_recipe bigint,
  p_image_urls text[],
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
  -- Only photos already stored on our image host (no hotlinking).
  image_re constant text := '^https://img\.zapiszprzepis\.pl/[^\s]+$';
  max_gallery constant int := 30;
  old_gallery text[];
  new_gallery text[];
  u text;
begin
  if not public.staff_can(p_actor, 'recipes.edit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_image_urls is null or cardinality(p_image_urls) not between 1 and 10
     or exists (select 1 from unnest(p_image_urls) s where s is null or char_length(s) > 500 or s !~ image_re) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  select * into rec from public.recipes where id = p_recipe for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  old_gallery := coalesce(rec.image_urls, '{}');
  new_gallery := case
    when cardinality(old_gallery) = 0 and rec.image_url is not null then array[rec.image_url]
    else old_gallery
  end;
  foreach u in array p_image_urls loop
    if not (u = any(new_gallery)) then
      new_gallery := new_gallery || u;
    end if;
  end loop;
  if cardinality(new_gallery) > max_gallery then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  update public.recipes set image_urls = new_gallery where id = p_recipe;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'recipes', 'add_gallery_images', p_recipe::text,
    jsonb_build_object('gallery_count', cardinality(old_gallery)),
    jsonb_build_object('gallery_count', cardinality(new_gallery), 'added', to_jsonb(p_image_urls))
  );
  return rec.slug;
end;
$$;

revoke all on function public.admin_add_gallery_images_as(uuid, bigint, text[], text, bigint) from public, anon, authenticated;
grant execute on function public.admin_add_gallery_images_as(uuid, bigint, text[], text, bigint) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.admin_add_gallery_images_as(uuid,bigint,text[],text,bigint)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_add_gallery_images_as(uuid,bigint,text[],text,bigint)', 'execute') then
    raise exception 'admin_add_gallery_images_as is executable by an API role';
  end if;
end $$;
