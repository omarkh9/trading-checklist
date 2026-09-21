-- Run this in the Supabase SQL editor for existing Edge Log projects.
alter table public.trades
  add column if not exists strategy text not null default '';
