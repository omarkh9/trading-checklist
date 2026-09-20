-- Run this in the Supabase SQL editor for existing Edge Log projects.
-- SQL Editor: https://supabase.com/dashboard/project/agfzhwyhrrcbadbzvmpy/sql/new
--
-- Stores MetaTrader 5 login/server metadata and a hashed webhook token on
-- each trading account. Linking is done from the journal modal; the gateway
-- then POSTs live balance, equity, and closed trades to
-- POST https://edge-log-11.netlify.app/api/mt5/webhook.

create extension if not exists pgcrypto with schema extensions;

alter table public.trading_accounts
  add column if not exists mt5_login text,
  add column if not exists mt5_server text,
  add column if not exists mt5_webhook_token_hash text,
  add column if not exists mt5_connection_id text,
  add column if not exists mt5_balance double precision,
  add column if not exists mt5_equity double precision,
  add column if not exists mt5_synced_at timestamptz;

alter table public.trades
  add column if not exists mt5_ticket text;

do $$
begin
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
