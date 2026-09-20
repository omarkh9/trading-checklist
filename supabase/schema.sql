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
  mt5_login text,
  mt5_server text,
  mt5_webhook_token_hash text,
  mt5_connection_id text,
  mt5_balance double precision,
  mt5_equity double precision,
  mt5_synced_at timestamptz,
  constraint trading_accounts_name_len check (
    char_length(trim(name)) between 1 and 48
  ),
  constraint trading_accounts_starting_balance_nonnegative check (
    starting_balance >= 0
  ),
  constraint trading_accounts_mt5_login_len check (
    mt5_login is null or char_length(trim(mt5_login)) between 1 and 32
  ),
  constraint trading_accounts_mt5_server_len check (
    mt5_server is null or char_length(trim(mt5_server)) between 1 and 64
  )
);

create unique index trading_accounts_user_name_lower_idx
  on public.trading_accounts (user_id, lower(name));

create index trading_accounts_user_created_idx
  on public.trading_accounts (user_id, created_at);

create unique index trading_accounts_mt5_webhook_token_hash_uidx
  on public.trading_accounts (mt5_webhook_token_hash)
  where mt5_webhook_token_hash is not null;

create index trading_accounts_mt5_login_idx
  on public.trading_accounts (mt5_login)
  where mt5_login is not null;

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
  account_id uuid references public.trading_accounts (id) on delete set null,
  mt5_ticket text
);

create index trades_created_at_idx on public.trades (created_at desc);
create index trades_user_id_idx on public.trades (user_id);
create index trades_account_id_idx on public.trades (account_id);
create unique index trades_user_mt5_ticket_uidx
  on public.trades (user_id, mt5_ticket);

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

create extension if not exists pgcrypto with schema extensions;

create or replace function public.apply_mt5_account_snapshot(
  p_token text,
  p_login text default '',
  p_server text default '',
  p_balance double precision default null,
  p_equity double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_account public.trading_accounts%rowtype;
  v_login text;
  v_server text;
begin
  if p_token is null or char_length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_balance is null or p_balance != p_balance then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  v_hash := encode(digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');
  v_login := nullif(trim(coalesce(p_login, '')), '');
  v_server := nullif(trim(coalesce(p_server, '')), '');

  select * into v_account
  from public.trading_accounts
  where mt5_webhook_token_hash = v_hash
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if v_account.mt5_login is not null
     and v_login is not null
     and v_account.mt5_login <> v_login then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if v_account.mt5_server is not null
     and v_server is not null
     and lower(v_account.mt5_server) <> lower(v_server) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  update public.trading_accounts
  set
    mt5_balance = p_balance,
    mt5_equity = coalesce(p_equity, p_balance),
    mt5_synced_at = timezone('utc', now()),
    mt5_login = coalesce(v_account.mt5_login, v_login),
    mt5_server = coalesce(v_account.mt5_server, v_server)
  where id = v_account.id
  returning * into v_account;

  return jsonb_build_object(
    'ok', true,
    'accountId', v_account.id,
    'balance', v_account.mt5_balance,
    'equity', v_account.mt5_equity,
    'syncedAt', v_account.mt5_synced_at
  );
end;
$$;

revoke all on function public.apply_mt5_account_snapshot(text, text, text, double precision, double precision) from public;
grant execute on function public.apply_mt5_account_snapshot(text, text, text, double precision, double precision) to anon, authenticated;

create or replace function public.ingest_mt5_closed_trades(
  p_token text,
  p_trades jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_account public.trading_accounts%rowtype;
  v_item jsonb;
  v_ticket text;
  v_ingested integer := 0;
begin
  if p_token is null or char_length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  v_hash := encode(digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  select * into v_account
  from public.trading_accounts
  where mt5_webhook_token_hash = v_hash
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_trades is null or jsonb_typeof(p_trades) <> 'array' then
    return jsonb_build_object(
      'ok', true,
      'accountId', v_account.id,
      'ingested', 0
    );
  end if;

  for v_item in select value from jsonb_array_elements(p_trades)
  loop
    v_ticket := nullif(trim(coalesce(v_item->>'ticket', '')), '');
    if v_ticket is null then
      continue;
    end if;

    insert into public.trades (
      user_id,
      pair,
      direction,
      entry_price,
      stop_loss,
      take_profit,
      outcome,
      pnl_mode,
      pnl_input,
      pnl_dollars,
      lot_size,
      account_balance_at_entry,
      account_id,
      strategy,
      notes,
      created_at,
      mt5_ticket
    )
    values (
      v_account.user_id,
      coalesce(nullif(trim(v_item->>'pair'), ''), 'UNKNOWN'),
      case
        when lower(coalesce(v_item->>'direction', '')) = 'short' then 'Short'::public.trade_direction
        else 'Long'::public.trade_direction
      end,
      coalesce(v_item->>'entryPrice', ''),
      coalesce(v_item->>'stopLoss', ''),
      coalesce(v_item->>'takeProfit', ''),
      case
        when coalesce((v_item->>'pnlDollars')::double precision, 0) > 0 then 'Win'::public.trade_outcome
        when coalesce((v_item->>'pnlDollars')::double precision, 0) < 0 then 'Loss'::public.trade_outcome
        else 'Breakeven'::public.trade_outcome
      end,
      'dollar'::public.trade_pnl_mode,
      coalesce(v_item->>'pnlDollars', '0'),
      coalesce((v_item->>'pnlDollars')::double precision, 0),
      coalesce(v_item->>'lotSize', ''),
      coalesce((v_item->>'accountBalanceAtEntry')::double precision, coalesce(v_account.mt5_balance, 0)),
      v_account.id,
      'MT5',
      coalesce(nullif(trim(v_item->>'notes'), ''), concat('MT5 #', v_ticket)),
      coalesce((v_item->>'createdAt')::timestamptz, timezone('utc', now())),
      v_ticket
    )
    on conflict (user_id, mt5_ticket)
    do update set
      pair = excluded.pair,
      direction = excluded.direction,
      entry_price = excluded.entry_price,
      stop_loss = excluded.stop_loss,
      take_profit = excluded.take_profit,
      outcome = excluded.outcome,
      pnl_input = excluded.pnl_input,
      pnl_dollars = excluded.pnl_dollars,
      lot_size = excluded.lot_size,
      account_balance_at_entry = excluded.account_balance_at_entry,
      notes = excluded.notes,
      created_at = excluded.created_at;

    v_ingested := v_ingested + 1;
  end loop;

  update public.trading_accounts
  set mt5_synced_at = timezone('utc', now())
  where id = v_account.id;

  return jsonb_build_object(
    'ok', true,
    'accountId', v_account.id,
    'ingested', v_ingested,
    'syncedAt', timezone('utc', now())
  );
end;
$$;

revoke all on function public.ingest_mt5_closed_trades(text, jsonb) from public;
grant execute on function public.ingest_mt5_closed_trades(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
