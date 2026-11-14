-- Emuluje tylko to, co dostarcza Supabase, a czego potrzebuje migracja.
-- Używane wyłącznie w lokalnych testach na zwykłym PostgreSQL (npm run test:db).
-- role są globalne dla klastra, więc tworzymy je tylko jeśli ich nie ma
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema auth;
create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
