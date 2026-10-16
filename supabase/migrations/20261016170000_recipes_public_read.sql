-- E01-S02 — Public read of recipes.
-- A guest (anon) and any authenticated user may READ every recipe. Writes stay
-- owner-only: the existing recipes_user_isolation policy is FOR ALL, and Postgres
-- OR-s permissive policies per command, so SELECT widens to everyone while
-- INSERT/UPDATE/DELETE still require user_id = public.current_user_id().
--
-- CONSEQUENCE (handled in the app, same slice): a SELECT can no longer lean on
-- RLS to mean "my recipes". Reads that must stay per-user now filter user_id
-- explicitly (the /recipes list + its category counts, the /settings count);
-- public reads (home "Ostatnio dodane", the recipe page by slug) intentionally
-- do not. recipe_shares, failed shares and the gallery are NOT opened here.
--
-- Rollback: drop this policy to return recipes to fully per-user visibility.
create policy recipes_public_read
  on public.recipes
  for select
  to anon, authenticated
  using (true);
