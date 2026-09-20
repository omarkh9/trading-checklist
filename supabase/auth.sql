-- Run this in the Supabase SQL editor for the existing Edge Log project.
-- SQL Editor: https://supabase.com/dashboard/project/agfzhwyhrrcbadbzvmpy/sql/new
--
-- Auth dashboard (required for live sign-up):
-- Authentication → Providers → Email: enable Email, allow new users to sign up.
-- Authentication → URL Configuration:
--   Site URL = https://edge-log-11.netlify.app
--   Redirect URLs include:
--     https://edge-log-11.netlify.app/**
--     https://edge-log-11.netlify.app/auth/callback
--     https://edge-log-11.netlify.app/auth/update-password
-- Do not add localhost redirect URLs. Confirmation and reset emails
-- must open on the production Netlify host.
--
-- If confirmation emails are on, users must open the Netlify callback link
-- before they can sign in. Keep Site URL on the production domain above.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (
    username ~ '^[A-Za-z0-9_]{3,24}$'
  )
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_username text;
  attempt integer := 0;
  suffix text;
begin
  chosen_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    regexp_replace(split_part(coalesce(new.email, 'trader'), '@', 1), '[^A-Za-z0-9_]', '_', 'g')
  );

  chosen_username := regexp_replace(chosen_username, '_+', '_', 'g');
  chosen_username := trim(both '_' from chosen_username);

  if length(chosen_username) < 3 then
    chosen_username := concat(chosen_username, '_trader');
  end if;

  chosen_username := left(chosen_username, 24);

  loop
    begin
      insert into public.profiles (id, username)
      values (new.id, chosen_username);
      exit;
    exception
      when unique_violation then
        attempt := attempt + 1;
        if attempt >= 8 then
          insert into public.profiles (id, username)
          values (new.id, left(replace(new.id::text, '-', ''), 24))
          on conflict (id) do nothing;
          exit;
        end if;
        suffix := substr(replace(new.id::text, '-', ''), 1, 4);
        chosen_username := left(
          concat(left(chosen_username, 18), '_', suffix, attempt::text),
          24
        );
    end;
  end loop;

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

drop policy if exists "Allow anon trade access while wiring the client" on public.trades;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trades'
      and column_name = 'user_id'
      and data_type = 'text'
  ) then
    alter table public.trades
      alter column user_id drop default;

    alter table public.trades
      alter column user_id type uuid using (
        case
          when user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then user_id::uuid
          else null
        end
      );
  end if;
end $$;

delete from public.trades
where user_id is null
   or not exists (select 1 from auth.users u where u.id = trades.user_id);

alter table public.trades
  alter column user_id set default auth.uid();

alter table public.trades
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trades_user_id_fkey'
  ) then
    alter table public.trades
      add constraint trades_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end $$;

drop policy if exists "Users can view own trades" on public.trades;
create policy "Users can view own trades"
  on public.trades
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own trades" on public.trades;
create policy "Users can insert own trades"
  on public.trades
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own trades" on public.trades;
create policy "Users can update own trades"
  on public.trades
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own trades" on public.trades;
create policy "Users can delete own trades"
  on public.trades
  for delete
  to authenticated
  using (auth.uid() = user_id);
