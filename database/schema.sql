-- Roommates Chore Planner — Supabase PostgreSQL schema
-- Run this entire script in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  invite_code text not null unique check (char_length(invite_code) = 8),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 100),
  description text check (description is null or char_length(description) <= 500),
  assigned_to uuid,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chores_assignee_member_fk foreign key (household_id, assigned_to)
    references public.household_members(household_id, user_id) on delete set null (assigned_to)
);

create index if not exists idx_household_members_user on public.household_members(user_id);
create index if not exists idx_chores_household_status on public.chores(household_id, status);
create index if not exists idx_chores_assigned_to on public.chores(assigned_to);
create index if not exists idx_chores_due_date on public.chores(due_date);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chores_set_updated_at on public.chores;
create trigger chores_set_updated_at
before update on public.chores
for each row execute function public.set_updated_at();

-- This starter uses a server-only Supabase service-role key.
-- Do not expose that key to the browser. All application data access goes
-- through the Express API, which verifies JWTs and household membership.
-- RLS is enabled as a defense-in-depth measure. The service-role key bypasses
-- RLS, so backend authorization checks remain mandatory.
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.chores enable row level security;

-- No anon/authenticated policies are intentionally created because the app
-- accesses these tables only from the protected Express backend. Do not use
-- the service-role key in any client-side code.