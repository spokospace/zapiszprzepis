-- Image archive storage bucket
-- Public bucket for recipe images downloaded from external sources (og:image).
-- Path scheme: <user_id>/<recipe_id>.<ext>. Service role writes from Inngest
-- extraction; public read via Supabase Storage CDN.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Public read for anyone (bucket is public). Service role does writes/deletes
-- directly via authentication context, so no explicit insert/update/delete
-- policy is needed for it — the postgres role bypasses RLS by default.
create policy recipe_images_public_read
  on storage.objects
  for select
  using (bucket_id = 'recipe-images');
