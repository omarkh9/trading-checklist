-- Run this in the Supabase SQL editor for existing Edge Log projects.
-- SQL Editor: https://supabase.com/dashboard/project/agfzhwyhrrcbadbzvmpy/sql/new
--
-- Creates public.checklist_rules and public.checklist_sessions so users can
-- save custom pre-trade rules and tick them for the current day's session.

create table if not exists public.checklist_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint checklist_rules_label_len check (char_length(trim(label)) between 1 and 160)
);

create index if not exists checklist_rules_user_sort_idx
  on public.checklist_rules (user_id, sort_order);

create table if not exists public.checklist_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_date date not null,
  checked_rule_ids uuid[] not null default '{}',
  confidence integer not null default 70,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint checklist_sessions_user_date_key unique (user_id, session_date),
  constraint checklist_sessions_confidence_range check (confidence between 0 and 100)
);

create index if not exists checklist_sessions_user_date_idx
  on public.checklist_sessions (user_id, session_date desc);

alter table public.checklist_rules enable row level security;
alter table public.checklist_sessions enable row level security;

drop policy if exists "Users can view own checklist rules" on public.checklist_rules;
drop policy if exists "Users can insert own checklist rules" on public.checklist_rules;
drop policy if exists "Users can update own checklist rules" on public.checklist_rules;
drop policy if exists "Users can delete own checklist rules" on public.checklist_rules;
drop policy if exists "Users can view own checklist sessions" on public.checklist_sessions;
drop policy if exists "Users can insert own checklist sessions" on public.checklist_sessions;
drop policy if exists "Users can update own checklist sessions" on public.checklist_sessions;
drop policy if exists "Users can delete own checklist sessions" on public.checklist_sessions;

create policy "Users can view own checklist rules"
  on public.checklist_rules
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own checklist rules"
  on public.checklist_rules
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own checklist rules"
  on public.checklist_rules
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own checklist rules"
  on public.checklist_rules
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can view own checklist sessions"
  on public.checklist_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own checklist sessions"
  on public.checklist_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own checklist sessions"
  on public.checklist_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own checklist sessions"
  on public.checklist_sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);
