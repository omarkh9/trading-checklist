-- Additive signup fixes. Safe to run on the live Edge Log project.
-- SQL Editor: https://supabase.com/dashboard/project/agfzhwyhrrcbadbzvmpy/sql/new
--
-- Also in Authentication → URL Configuration, set:
--   Site URL = https://edgelog.org
--   Redirect URLs:
--     https://edgelog.org/**
--     https://edgelog.org/auth/callback
--     https://edgelog.org/auth/update-password
-- Do not add localhost. Email confirmation must land on production.
-- Authentication → Providers → Email: enable Email and allow new users.

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
