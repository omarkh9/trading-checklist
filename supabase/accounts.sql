-- Run this in the Supabase SQL editor for existing Edge Log projects.
-- SQL Editor: https://supabase.com/dashboard/project/agfzhwyhrrcbadbzvmpy/sql/new
--
-- Adds up to 10 trading accounts per user, each with its own starting
-- balance. Trades and journal entries are scoped with trades.account_id.

create table if not exists public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  starting_balance double precision not null default 10000,
  created_at timestamptz not null default timezone('utc', now()),
  constraint trading_accounts_name_len check (
    char_length(trim(name)) between 1 and 48
  ),
  constraint trading_accounts_starting_balance_nonnegative check (
    starting_balance >= 0
  )
);

create unique index if not exists trading_accounts_user_name_lower_idx
  on public.trading_accounts (user_id, lower(name));

create index if not exists trading_accounts_user_created_idx
  on public.trading_accounts (user_id, created_at);

alter table public.trading_accounts enable row level security;

drop policy if exists "Users can view own trading accounts" on public.trading_accounts;
create policy "Users can view own trading accounts"
  on public.trading_accounts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own trading accounts" on public.trading_accounts;
create policy "Users can insert own trading accounts"
  on public.trading_accounts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own trading accounts" on public.trading_accounts;
create policy "Users can update own trading accounts"
  on public.trading_accounts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own trading accounts" on public.trading_accounts;
create policy "Users can delete own trading accounts"
  on public.trading_accounts
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.enforce_trading_account_limit()
returns trigger
language plpgsql
as $$
declare
  account_count integer;
begin
  select count(*) into account_count
  from public.trading_accounts
  where user_id = new.user_id;

  if account_count >= 10 then
    raise exception 'You can keep up to 10 trading accounts.';
  end if;

  return new;
end;
$$;

drop trigger if exists trading_accounts_limit on public.trading_accounts;
create trigger trading_accounts_limit
  before insert on public.trading_accounts
  for each row execute procedure public.enforce_trading_account_limit();

alter table public.trades
  add column if not exists account_id uuid references public.trading_accounts (id) on delete set null;

create index if not exists trades_account_id_idx
  on public.trades (account_id);

create or replace function public.handle_new_trading_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.trading_accounts
    where user_id = new.id
  ) then
    insert into public.trading_accounts (user_id, name, starting_balance)
    values (new.id, 'Main', 10000);
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_trading_account on public.profiles;
create trigger on_profile_trading_account
  after insert on public.profiles
  for each row execute procedure public.handle_new_trading_account();

insert into public.trading_accounts (user_id, name, starting_balance)
select p.id, 'Main', 10000
from public.profiles p
where not exists (
  select 1
  from public.trading_accounts a
  where a.user_id = p.id
);

update public.trades t
set account_id = a.id
from public.trading_accounts a
where t.account_id is null
  and a.user_id = t.user_id
  and lower(a.name) = 'main';
