# Account deletion — owner runbook

`/usuwanie-danych` promises that an account is deleted on request (no self-service yet). Deleting the user in
Supabase Dashboard (Authentication → Users → Delete) is **not enough** on its own.

What the database does by itself when `auth.users` row is deleted:

- `transfer_recipes_on_account_delete` (BEFORE DELETE) hands every recipe that someone else favorited to the
  earliest favoriter.
- `ON DELETE CASCADE` removes `profiles`, `profiles_private`, `favorites`, `recipe_shares` (incl. read state),
  `user_full_access`, `access_code_attempts` and the user's remaining (non-transferred) `recipes`.

What you must do by hand, in this order:

1. **Before deleting the user**, note their `id` (uuid) and which of their recipes will be transferred
   (recipes with a favorite from another user).
2. Delete the user in Supabase Dashboard.
3. Storage, bucket `avatars`: delete the folder `{user_id}/`.
4. Storage, bucket `recipe-images`: delete `{user_id}/…` objects **except** those referenced by a transferred
   recipe (its `image_url` / `image_urls` still point into the deleted user's folder).
5. Service tables without a foreign key (from the one-off duplicate collapse): delete rows with this `user_id`
   from `recipes_merged_duplicates`, and `recipe_merge_log` rows of the `favorite_*` kinds whose `ref_id` is
   the user id.
6. R2 backups (`zapiszprzepis-backups/recipes/*.json`) expire on their own after 90 days — nothing to do, but the
   policy text relies on that lifecycle rule being enabled in Cloudflare.
7. Reply to the requester within one month.
