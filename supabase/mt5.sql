-- Run this in the Supabase SQL editor for existing Edge Log projects.
-- SQL Editor: https://supabase.com/dashboard/project/agfzhwyhrrcbadbzvmpy/sql/new
--
-- Stores MetaTrader 5 login/server metadata, a hashed webhook token, and an
-- encrypted investor password on each trading account. Users enter login,
-- investor password, and server from the journal. The worker reads those
-- saved credentials via POST https://edgelog.org/api/mt5/sync.
-- The gateway can still POST live snapshots to /api/mt5/webhook.
-- Cron: Authorization: Bearer MT5_SYNC_SECRET with { "all": true }.

create extension if not exists pgcrypto with schema extensions;

-- Existing projects may have been created from an older accounts.sql that used
-- `balance` instead of `starting_balance`. Add every column the journal writes
-- so PostgREST stops returning schema-cache errors on insert/update.
alter table public.trading_accounts
  add column if not exists name text,
  add column if not exists starting_balance numeric(18, 2) not null default 10000,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists mt5_login text,
  add column if not exists mt5_server text,
  add column if not exists mt5_password text,
  add column if not exists mt5_webhook_token_hash text,
  add column if not exists mt5_connection_id text,
  add column if not exists mt5_balance numeric(18, 2),
  add column if not exists mt5_equity numeric(18, 2),
  add column if not exists mt5_synced_at timestamptz,
  add column if not exists mt5_active_at timestamptz,
  add column if not exists mt5_investor_password_cipher text,
  add column if not exists mt5_credentials_set boolean not null default false;

comment on column public.trading_accounts.mt5_investor_password_cipher is
  'AES-GCM ciphertext of the investor password. Server-only; never send to the browser.';
comment on column public.trading_accounts.mt5_password is
  'Encrypted investor password (same ciphertext as mt5_investor_password_cipher).';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_accounts'
      and column_name = 'balance'
  ) then
    update public.trading_accounts
    set starting_balance = round(balance::numeric, 2)
    where starting_balance is distinct from round(balance::numeric, 2)
      and balance is not null;
  end if;
end $$;

alter table public.trades
  add column if not exists account_id uuid references public.trading_accounts (id) on delete set null,
  add column if not exists mt5_ticket text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trading_accounts_starting_balance_nonnegative'
  ) then
    alter table public.trading_accounts
      add constraint trading_accounts_starting_balance_nonnegative check (
        starting_balance >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trading_accounts_mt5_login_len'
  ) then
    alter table public.trading_accounts
      add constraint trading_accounts_mt5_login_len check (
        mt5_login is null or char_length(trim(mt5_login)) between 1 and 32
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trading_accounts_mt5_server_len'
  ) then
    alter table public.trading_accounts
      add constraint trading_accounts_mt5_server_len check (
        mt5_server is null or char_length(trim(mt5_server)) between 1 and 64
      );
  end if;
end $$;

-- Reload PostgREST so starting_balance / mt5_* appear in the schema cache
-- even if a later statement in this script fails.
notify pgrst, 'reload schema';

create unique index if not exists trading_accounts_mt5_webhook_token_hash_uidx
  on public.trading_accounts (mt5_webhook_token_hash)
  where mt5_webhook_token_hash is not null;

create index if not exists trading_accounts_mt5_login_idx
  on public.trading_accounts (mt5_login)
  where mt5_login is not null;

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

  if p_balance is null or p_balance != p_balance or p_balance <= 0 then
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
    mt5_equity = case
      when p_equity is not null and p_equity = p_equity and p_equity > 0 then p_equity
      else p_balance
    end,
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

create or replace function public.save_mt5_account_credentials(
  p_account_id uuid,
  p_login text,
  p_server text,
  p_password_cipher text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.trading_accounts%rowtype;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_account_id is null
     or p_login is null
     or char_length(trim(p_login)) not between 1 and 32
     or p_server is null
     or char_length(trim(p_server)) not between 1 and 64
     or p_password_cipher is null
     or char_length(trim(p_password_cipher)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  update public.trading_accounts
  set
    mt5_login = trim(p_login),
    mt5_server = trim(p_server),
    mt5_password = p_password_cipher,
    mt5_investor_password_cipher = p_password_cipher,
    mt5_credentials_set = true
  where id = p_account_id
    and user_id = v_user
  returning * into v_account;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'accountId', v_account.id,
    'login', v_account.mt5_login,
    'server', v_account.mt5_server
  );
end;
$$;

revoke all on function public.save_mt5_account_credentials(uuid, text, text, text) from public;
grant execute on function public.save_mt5_account_credentials(uuid, text, text, text) to authenticated;

create or replace function public.save_mt5_account_snapshot(
  p_account_id uuid,
  p_user_id uuid,
  p_balance double precision,
  p_equity double precision default null,
  p_connection_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.trading_accounts%rowtype;
  v_user uuid := auth.uid();
begin
  if p_account_id is null
     or p_user_id is null
     or p_balance is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_snapshot');
  end if;

  if v_user is not null and v_user is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  update public.trading_accounts
  set
    mt5_balance = p_balance,
    mt5_equity = coalesce(p_equity, p_balance),
    mt5_synced_at = timezone('utc', now()),
    mt5_connection_id = coalesce(nullif(trim(p_connection_id), ''), mt5_connection_id)
  where id = p_account_id
    and user_id = p_user_id
  returning * into v_account;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'accountId', v_account.id,
    'balance', v_account.mt5_balance,
    'equity', v_account.mt5_equity,
    'mt5_balance', v_account.mt5_balance,
    'mt5_equity', v_account.mt5_equity,
    'syncedAt', v_account.mt5_synced_at,
    'mt5_synced_at', v_account.mt5_synced_at
  );
end;
$$;

revoke all on function public.save_mt5_account_snapshot(uuid, uuid, double precision, double precision, text) from public;
grant execute on function public.save_mt5_account_snapshot(uuid, uuid, double precision, double precision, text) to authenticated, service_role;

create or replace function public.load_mt5_account_credentials(
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.trading_accounts%rowtype;
  v_user uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
begin
  if p_account_id is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;

  if v_role = 'service_role' then
    select * into v_account
    from public.trading_accounts
    where id = p_account_id;
  elsif v_user is not null then
    select * into v_account
    from public.trading_accounts
    where id = p_account_id
      and user_id = v_user;
  else
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'accountId', v_account.id,
    'userId', v_account.user_id,
    'login', v_account.mt5_login,
    'server', v_account.mt5_server,
    'passwordCipher', coalesce(
      nullif(v_account.mt5_investor_password_cipher, ''),
      v_account.mt5_password
    ),
    'connectionId', v_account.mt5_connection_id,
    'credentialsSet', v_account.mt5_credentials_set
  );
end;
$$;

revoke all on function public.load_mt5_account_credentials(uuid) from public;
grant execute on function public.load_mt5_account_credentials(uuid) to authenticated, service_role;

create unique index if not exists trades_user_mt5_ticket_uidx
  on public.trades (user_id, mt5_ticket);

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
    -- Only broker-owned columns. Notes (which carry emotions and rule scores),
    -- strategy, charts and the id belong to the journal and must survive.
    do update set
      pair = excluded.pair,
      direction = excluded.direction,
      entry_price = coalesce(nullif(excluded.entry_price, ''), trades.entry_price),
      -- A blank broker SL/TP means "none on the order", not "clear the journal's".
      stop_loss = coalesce(nullif(excluded.stop_loss, ''), trades.stop_loss),
      take_profit = coalesce(nullif(excluded.take_profit, ''), trades.take_profit),
      outcome = excluded.outcome,
      pnl_mode = case
        when trades.pnl_dollars = excluded.pnl_dollars then trades.pnl_mode
        else excluded.pnl_mode
      end,
      pnl_input = case
        when trades.pnl_dollars = excluded.pnl_dollars then trades.pnl_input
        else excluded.pnl_input
      end,
      pnl_dollars = excluded.pnl_dollars,
      lot_size = coalesce(nullif(excluded.lot_size, ''), trades.lot_size),
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

-- Final cache reload after RPCs and indexes are in place.
notify pgrst, 'reload schema';
