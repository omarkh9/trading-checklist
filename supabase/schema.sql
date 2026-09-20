-- Full schema for a new Edge Log project.
-- Existing projects that already ran schema.sql should run supabase/auth.sql instead.

create type public.trade_direction as enum ('Long', 'Short');
create type public.trade_outcome as enum ('Win', 'Loss', 'Breakeven');
create type public.trade_pnl_mode as enum ('dollar', 'percent');
create type public.trade_risk_size_mode as enum ('fixed', 'percent');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (
    username ~ '^[A-Za-z0-9_]{3,24}$'
  )
);

create unique index profiles_username_lower_idx
  on public.profiles (lower(username));

create table public.trading_accounts (
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

create unique index trading_accounts_user_name_lower_idx
  on public.trading_accounts (user_id, lower(name));

create index trading_accounts_user_created_idx
  on public.trading_accounts (user_id, created_at);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pair text not null,
  higher_time_frame text,
  middle_time_frame text,
  lower_time_frame text,
  entry text,
  direction public.trade_direction not null,
  entry_price text not null default '',
  stop_loss text not null default '',
  take_profit text not null default '',
  outcome public.trade_outcome not null,
  pnl_mode public.trade_pnl_mode not null default 'dollar',
  pnl_input text not null default '',
  pnl_dollars double precision not null default 0,
  risk_size_mode public.trade_risk_size_mode not null default 'percent',
  risk_percent text not null default '1',
  fixed_lot_size text not null default '',
  lot_size text not null default '',
  account_balance_at_entry double precision not null default 0,
  strategy text not null default '',
  notes text not null default '',
  before_chart text,
  after_chart text,
  created_at timestamptz not null default timezone('utc', now()),
  account_id uuid references public.trading_accounts (id) on delete set null
);

create index trades_created_at_idx on public.trades (created_at desc);
create index trades_user_id_idx on public.trades (user_id);
create index trades_account_id_idx on public.trades (account_id);

alter table public.profiles enable row level security;
alter table public.trading_accounts enable row level security;
alter table public.trades enable row level security;

create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can view own trading accounts"
  on public.trading_accounts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own trading accounts"
  on public.trading_accounts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own trading accounts"
  on public.trading_accounts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own trading accounts"
  on public.trading_accounts
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can view own trades"
  on public.trades
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own trades"
  on public.trades
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own trades"
  on public.trades
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own trades"
  on public.trades
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_username text;
begin
  chosen_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    regexp_replace(split_part(new.email, '@', 1), '[^A-Za-z0-9_]', '_', 'g')
  );

  if length(chosen_username) < 3 then
    chosen_username := concat(chosen_username, '_trader');
  end if;

  insert into public.profiles (id, username)
  values (new.id, left(chosen_username, 24))
  on conflict (id) do nothing;

  if not exists (
    select 1 from public.trading_accounts where user_id = new.id
  ) then
    insert into public.trading_accounts (user_id, name, starting_balance)
    values (new.id, 'Main', 10000);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

create or replace function public.username_taken(uname text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where lower(username) = lower(uname)
  );
$$;

create or replace function public.email_for_username(uname text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(uname)
  limit 1;
$$;

grant execute on function public.username_taken(text) to anon, authenticated;
grant execute on function public.email_for_username(text) to anon, authenticated;

create table public.checklist_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint checklist_rules_label_len check (char_length(trim(label)) between 1 and 160)
);

create index checklist_rules_user_sort_idx
  on public.checklist_rules (user_id, sort_order);

create table public.checklist_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_date date not null,
  checked_rule_ids uuid[] not null default '{}',
  confidence integer not null default 70,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint checklist_sessions_user_date_key unique (user_id, session_date),
  constraint checklist_sessions_confidence_range check (confidence between 0 and 100)
);

create index checklist_sessions_user_date_idx
  on public.checklist_sessions (user_id, session_date desc);

alter table public.checklist_rules enable row level security;
alter table public.checklist_sessions enable row level security;

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
