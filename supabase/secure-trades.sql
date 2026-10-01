-- Run this in the Supabase SQL editor for existing Edge Log projects.
-- SQL Editor: https://supabase.com/dashboard/project/agfzhwyhrrcbadbzvmpy/sql/new
--
-- Replaces the open "Allow anon trade access while wiring the client" policy,
-- which let anyone holding the public anon key read, change, or delete every
-- user's trades, with owner-only policies.
--
-- Non-destructive, unlike auth.sql: no rows are deleted and user_id keeps its
-- type. Comparing as text works whether user_id is text (older projects) or
-- uuid. Rows without a matching owner simply stop being visible.

begin;

drop policy if exists "Allow anon trade access while wiring the client" on public.trades;

drop policy if exists "Users can view own trades" on public.trades;
create policy "Users can view own trades"
  on public.trades
  for select
  to authenticated
  using (auth.uid()::text = user_id::text);

drop policy if exists "Users can insert own trades" on public.trades;
create policy "Users can insert own trades"
  on public.trades
  for insert
  to authenticated
  with check (auth.uid()::text = user_id::text);

drop policy if exists "Users can update own trades" on public.trades;
create policy "Users can update own trades"
  on public.trades
  for update
  to authenticated
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

drop policy if exists "Users can delete own trades" on public.trades;
create policy "Users can delete own trades"
  on public.trades
  for delete
  to authenticated
  using (auth.uid()::text = user_id::text);

alter table public.trades enable row level security;

commit;
