-- E01-S06 — Favorites: a private bookmark of any recipe (own or someone else's).
-- A favorite is just the (user, recipe) pair; there is no update path.
--
-- The recipe FK check runs as the table owner, so a user can favorite any
-- recipe id even though `recipes` itself is owner-only under RLS — those ids
-- are public through public_recipes anyway.
--
-- Rollback: drop table public.favorites (no other object depends on it yet;
-- E01-S03a will).

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id bigint not null references public.recipes(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (user_id, recipe_id)
);

comment on table public.favorites is
  'Per-user bookmarks of any recipe (E01-S06). Private: owner-only RLS.';

-- Lookups by recipe (E01-S03a: "does anyone else have this as a favorite").
create index favorites_recipe_id_idx on public.favorites (recipe_id);

alter table public.favorites enable row level security;

create policy favorites_owner_select
  on public.favorites for select
  to authenticated
  using (user_id = public.current_user_id());

create policy favorites_owner_insert
  on public.favorites for insert
  to authenticated
  with check (user_id = public.current_user_id());

create policy favorites_owner_delete
  on public.favorites for delete
  to authenticated
  using (user_id = public.current_user_id());

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated. Favorites are private and have no update path.
revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
