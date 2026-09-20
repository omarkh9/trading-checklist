-- Run this in the Supabase SQL editor for existing Edge Log projects.
-- SQL Editor: https://supabase.com/dashboard/project/agfzhwyhrrcbadbzvmpy/sql/new
--
-- Stores MetaTrader 5 login/server metadata and a hashed webhook token on
-- each trading account. MT5 (or a bridge EA) POSTs live balance/equity to
-- POST https://edge-log-11.netlify.app/api/mt5/webhook with the raw token.

create extension if not exists pgcrypto with schema extensions;

alter table public.trading_accounts
  add column if not exists mt5_login text,
  add column if not exists mt5_server text,
  add column if not exists mt5_webhook_token_hash text,
  add column if not exists mt5_balance double precision,
  add column if not exists mt5_equity double precision,
  add column if not exists mt5_synced_at timestamptz;

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
