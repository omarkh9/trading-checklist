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
  created_at timestamptz not null default timezone('utc', now())
);

create index trades_created_at_idx on public.trades (created_at desc);
create index trades_user_id_idx on public.trades (user_id);

alter table public.profiles enable row level security;
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
