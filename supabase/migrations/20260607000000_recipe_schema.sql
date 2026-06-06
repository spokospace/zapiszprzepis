-- Recipe schema for S-01: first-shared-recipe-fb-text
-- Tables: recipes (core data), recipe_shares (share intent tracking)

-- Enum: recipe source type
create type public.recipe_source as enum (
  'facebook_text',
  'web_blog',
  'facebook_reel',
  'youtube',
  'other'
);

-- Enum: recipe category (fixed taxonomy)
create type public.recipe_category as enum (
  'obiady',
  'zupy',
  'desery',
  'sniadania',
  'przekaski',
  'wegetarianskie',
  'napoje',
  'inne'
);

-- Enum: recipe share status
create type public.recipe_share_status as enum (
  'pending',
  'completed',
  'failed'
);

-- Recipes table: core recipe data
create table public.recipes (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  image_url text,
  ingredients jsonb not null default '[]'::jsonb, -- Array of {name: str, amount: str, unit: str}
  steps jsonb not null default '[]'::jsonb, -- Array of strings
  source_type public.recipe_source not null,
  source_url text,
  category public.recipe_category not null,
  extracted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  unique(user_id, slug)
);

comment on table public.recipes is
  'User recipes extracted from shared URLs. Each recipe is owned by a user (per-user RLS).';

comment on column public.recipes.ingredients is
  'Array of ingredient objects: [{name: str, amount: str, unit: str}, ...]';

comment on column public.recipes.steps is
  'Array of cooking steps as strings, in order.';

-- Recipe shares table: track share intents and processing status
create table public.recipe_shares (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id bigint references public.recipes(id) on delete set null,
  shared_url text not null,
  share_intent jsonb not null, -- {url: str, title?: str, text?: str}
  status public.recipe_share_status not null default 'pending'::public.recipe_share_status,
  error_message text,
  attempts int not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

comment on table public.recipe_shares is
  'Share intent log: tracks when a URL is shared and extraction status.';

-- Indexes for performance
create index idx_recipes_user_created on public.recipes(user_id, created_at desc);
create index idx_recipes_user_slug on public.recipes(user_id, slug);
create index idx_recipe_shares_user_status on public.recipe_shares(user_id, status);
create index idx_recipe_shares_recipe on public.recipe_shares(recipe_id);

-- Enable RLS
alter table public.recipes enable row level security;
alter table public.recipe_shares enable row level security;

-- RLS: recipes — user can select/insert/update/delete only own recipes
create policy recipes_user_isolation
  on public.recipes
  for all
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- RLS: recipe_shares — user can select/insert/update/delete only own shares
create policy recipe_shares_user_isolation
  on public.recipe_shares
  for all
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- Trigger: update updated_at on recipes
create or replace function public.update_recipes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recipes_updated_at_trigger
  before update on public.recipes
  for each row
  execute function public.update_recipes_updated_at();

-- Trigger: update updated_at on recipe_shares
create or replace function public.update_recipe_shares_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recipe_shares_updated_at_trigger
  before update on public.recipe_shares
  for each row
  execute function public.update_recipe_shares_updated_at();
