-- Recipes are served as static files, so a change reaches readers only through a new build.
-- content_version moves on every change a public page can show. The build saves the version it
-- read; the Worker's cron compares the two and calls the Workers Builds deploy hook when the
-- site is behind (src/lib/recipe-files-refresh.ts). The other columns cap how often it does.
create table if not exists public.recipe_files_state (
  id boolean primary key default true check (id),
  content_version bigint not null default 0,
  build_requested_at timestamptz,
  builds_day date,
  builds_today integer not null default 0
);

insert into public.recipe_files_state (id) values (true) on conflict (id) do nothing;

alter table public.recipe_files_state enable row level security;
revoke all on public.recipe_files_state from anon, authenticated;

create or replace function public.bump_recipe_content_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- recipes_updated_at_trigger touches updated_at on every update, also one that changes nothing.
  if tg_op = 'UPDATE' and to_jsonb(old) - 'updated_at' = to_jsonb(new) - 'updated_at' then
    return null;
  end if;
  update public.recipe_files_state set content_version = content_version + 1;
  return null;
end;
$$;

revoke all on function public.bump_recipe_content_version() from public, anon, authenticated;

drop trigger if exists recipes_bump_content_version on public.recipes;
create trigger recipes_bump_content_version
  after insert or update or delete on public.recipes
  for each row execute function public.bump_recipe_content_version();

-- Recipe pages show the author's name and link to the profile.
drop trigger if exists profiles_bump_content_version on public.profiles;
create trigger profiles_bump_content_version
  after update of display_name, username on public.profiles
  for each row
  when (old.display_name is distinct from new.display_name or old.username is distinct from new.username)
  execute function public.bump_recipe_content_version();

-- The build reads this with the anon key; it says nothing but a number.
create or replace function public.recipe_content_version()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select content_version from public.recipe_files_state;
$$;

revoke all on function public.recipe_content_version() from public;
grant execute on function public.recipe_content_version() to anon, authenticated;
