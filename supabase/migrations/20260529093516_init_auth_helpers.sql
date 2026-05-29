-- Enable pg_trgm for FR-013 (search) used in slice S-06.
create extension if not exists pg_trgm;

-- RLS helper: wrap auth.uid() as STABLE so Postgres caches it per query.
-- Convention: every per-user table in this project has RLS enabled and
-- policies that filter by user_id = public.current_user_id().
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid()
$$;

comment on function public.current_user_id() is
  'Returns the authenticated user id (auth.uid()) for RLS policies. '
  'Convention: every per-user table in this project has RLS enabled '
  'and policies that filter by user_id = public.current_user_id().';

grant execute on function public.current_user_id() to authenticated, anon;
