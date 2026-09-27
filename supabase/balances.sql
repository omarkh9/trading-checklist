-- Run this in the Supabase SQL editor for existing Edge Log projects.
-- SQL Editor: https://supabase.com/dashboard/project/agfzhwyhrrcbadbzvmpy/sql/new
--
-- Store account and trade money as numeric(18, 2) so values like 101000
-- are not truncated and cents stay exact. PostgREST may return these
-- columns as strings; the app coerces them back to numbers.

alter table public.trading_accounts
  alter column starting_balance type numeric(18, 2)
  using round(coalesce(starting_balance, 0)::numeric, 2);

alter table public.trading_accounts
  alter column starting_balance set default 10000;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_accounts'
      and column_name = 'mt5_balance'
  ) then
    alter table public.trading_accounts
      alter column mt5_balance type numeric(18, 2)
      using round(mt5_balance::numeric, 2);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_accounts'
      and column_name = 'mt5_equity'
  ) then
    alter table public.trading_accounts
      alter column mt5_equity type numeric(18, 2)
      using round(mt5_equity::numeric, 2);
  end if;
end
$$;

alter table public.trades
  alter column pnl_dollars type numeric(18, 2)
  using round(coalesce(pnl_dollars, 0)::numeric, 2);

alter table public.trades
  alter column account_balance_at_entry type numeric(18, 2)
  using round(coalesce(account_balance_at_entry, 0)::numeric, 2);

notify pgrst, 'reload schema';
