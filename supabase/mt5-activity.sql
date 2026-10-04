-- Run this in the Supabase SQL editor for existing Edge Log projects.
-- SQL Editor: https://supabase.com/dashboard/project/agfzhwyhrrcbadbzvmpy/sql/new
--
-- Records when each linked MT5 account last synced from the app, so the hourly
-- idle job (netlify/functions/mt5-idle.mjs) can pause MetaAPI accounts nobody
-- has used for 6 hours. Additive only.

alter table public.trading_accounts
  add column if not exists mt5_active_at timestamptz;

notify pgrst, 'reload schema';
