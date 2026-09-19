-- Paste this into the Supabase SQL editor (Project → SQL → New query) and run it.
-- Tightens later: replace the open RLS policy once Clerk user IDs are stored on rows.

create type public.trade_direction as enum ('Long', 'Short');
create type public.trade_outcome as enum ('Win', 'Loss', 'Breakeven');
create type public.trade_pnl_mode as enum ('dollar', 'percent');
create type public.trade_risk_size_mode as enum ('fixed', 'percent');

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id text,
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
  notes text not null default '',
  before_chart text,
  after_chart text,
  created_at timestamptz not null default timezone('utc', now())
);

create index trades_created_at_idx on public.trades (created_at desc);
create index trades_user_id_idx on public.trades (user_id);

alter table public.trades enable row level security;

create policy "Allow anon trade access while wiring the client"
  on public.trades
  for all
  to anon, authenticated
  using (true)
  with check (true);
