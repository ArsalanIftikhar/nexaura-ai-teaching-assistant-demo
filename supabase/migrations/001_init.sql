create extension if not exists "pgcrypto";

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  role text not null default 'school',
  created_at timestamp with time zone default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  mode text not null,
  created_at timestamp with time zone default now(),
  latency_ms integer not null,
  model text not null,
  tokens_estimate integer,
  cost_estimate_usd numeric
);

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.usage_events enable row level security;

create policy "Schools are visible to own school" on public.schools
  for select
  using (exists (
    select 1 from public.profiles
    where profiles.school_id = schools.id
      and profiles.id = auth.uid()
  ));

create policy "Schools can be inserted by authenticated users" on public.schools
  for insert
  with check (auth.role() = 'authenticated');

create policy "Profiles are readable by owner" on public.profiles
  for select
  using (id = auth.uid());

create policy "Profiles can be inserted by owner" on public.profiles
  for insert
  with check (id = auth.uid());

create policy "Profiles can be updated by owner" on public.profiles
  for update
  using (id = auth.uid());
