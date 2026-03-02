create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key,
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  branding jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  roster jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  meta jsonb not null default '{}'::jsonb,
  players jsonb not null default '[]'::jsonb,
  batting_order jsonb not null default '[]'::jsonb,
  assignments jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  log jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.drafts (
  team_id uuid primary key references public.teams(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  players jsonb not null default '[]'::jsonb,
  batting_order jsonb not null default '[]'::jsonb,
  assignments jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  log jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_teams_owner_id on public.teams(owner_id);
create index if not exists idx_games_team_owner on public.games(team_id, owner_id);
create index if not exists idx_drafts_owner_id on public.drafts(owner_id);

alter table public.users disable row level security;
alter table public.teams disable row level security;
alter table public.games disable row level security;
alter table public.drafts disable row level security;
