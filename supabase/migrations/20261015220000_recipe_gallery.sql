-- Recipe gallery: every photo of the recipe (cover first, at most 12), as
-- Storage URLs under <user_id>/<recipe_id>/<n>.<ext>. image_url stays the
-- cover. Empty when the source had a single photo.
alter table public.recipes
  add column image_urls text[] not null default '{}';

-- Deleting a recipe removes its images through the user's own session, which
-- had no storage delete policy, so the files outlived the recipe. Owners may
-- delete what sits under their own <user_id>/ folder.
create policy recipe_images_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
