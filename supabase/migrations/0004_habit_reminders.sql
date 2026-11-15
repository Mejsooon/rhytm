-- Rhytm etap 2b: godzina przypomnienia nawyku, subskrypcje Web Push, funkcje dla crona.
begin;

-- Godzina przypomnienia (HH:mm, czas lokalny z profiles.timezone) i dzień ostatniego przypomnienia
alter table habits
  add column remind_at time null check (remind_at is null or extract(second from remind_at) = 0),
  add column last_reminded_on date null;

-- Subskrypcja Web Push jednej przeglądarki/urządzenia
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub'),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
create index push_subscriptions_user_id_idx on push_subscriptions (user_id);

-- Supabase domyślnie daje anon/authenticated wszystko na nowych tabelach: zostawiamy tylko to, czego używa aplikacja
revoke all on push_subscriptions from anon, authenticated, service_role;
grant select, insert, delete on push_subscriptions to authenticated;

alter table push_subscriptions enable row level security;

create policy push_subscriptions_own on push_subscriptions for all to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));

-- Wybiera nawyki, którym właśnie wypada przypomnienie, i w tej samej instrukcji oznacza je
-- jako przypomniane dziś (lokalnie). Zwraca jeden wiersz na parę (nawyk, subskrypcja).
-- Nawyk wypada, gdy:
--   remind_at <= czas lokalny < remind_at + 15 min, i dziś jeszcze nie przypominano,
--   nie jest zarchiwizowany (archived_at > dziś albo null),
--   ma harmonogram obowiązujący dziś (największe valid_from <= dziś; brak = nawyk jeszcze nie istnieje),
--   jest dziś zaplanowany (daily / dzień ISO w weekdays / weekly z mniejszą liczbą odhaczeń w tygodniu ISO niż times_per_week),
--   nie jest dziś odhaczony,
--   użytkownik ma co najmniej jedną subskrypcję.
create function public.claim_due_habit_reminders(p_now timestamptz)
returns table (endpoint text, p256dh text, auth text, habit_id uuid, habit_name text)
language sql
security definer
set search_path = ''
as $$
  -- profiles.timezone to wolny tekst edytowalny przez użytkownika: nieznana strefa rzuciłaby
  -- błędem w "at time zone" i zablokowała przypomnienia wszystkim, więc takie profile pomijamy.
  -- Strażnik jest w CASE (a nie tylko w WHERE), bo planer może policzyć wyrażenie przed filtrem.
  with local_now as (
    select p.user_id,
      case when p.timezone in (select tzn.name from pg_catalog.pg_timezone_names as tzn)
        then p_now at time zone p.timezone
      end as local_ts
    from public.profiles as p
  ),
  due as (
    select h.id, ln.local_ts::date as local_day
    from public.habits as h
    join local_now as ln on ln.user_id = h.user_id
    join lateral (
      select s.schedule_type, s.weekdays, s.times_per_week
      from public.habit_schedules as s
      where s.habit_id = h.id and s.valid_from <= ln.local_ts::date
      order by s.valid_from desc
      limit 1
    ) as sch on true
    where h.remind_at is not null
      and ln.local_ts is not null
      -- okno liczone na znacznikach czasu, żeby 23:50 + 15 min nie zawijało się przez północ;
      -- remind_at w godzinie pominiętej przy przejściu na czas letni (np. 02:30 w Warszawie)
      -- nie wypada tego dnia, bo czas lokalny nigdy nie trafia w okno
      and ln.local_ts >= ln.local_ts::date + h.remind_at
      and ln.local_ts < ln.local_ts::date + h.remind_at + interval '15 minutes'
      and h.last_reminded_on is distinct from ln.local_ts::date
      and (h.archived_at is null or h.archived_at > ln.local_ts::date)
      and case sch.schedule_type
        when 'daily' then true
        when 'days' then extract(isodow from ln.local_ts)::int = any (sch.weekdays)
        when 'weekly' then (
          select count(*)
          from public.habit_checks as c
          where c.habit_id = h.id
            and c.date >= date_trunc('week', ln.local_ts)::date
            and c.date < date_trunc('week', ln.local_ts)::date + 7
        ) < sch.times_per_week
        else false
      end
      and not exists (
        select 1 from public.habit_checks as c
        where c.habit_id = h.id and c.date = ln.local_ts::date)
      and exists (
        select 1 from public.push_subscriptions as ps
        where ps.user_id = h.user_id)
  ),
  claimed as (
    update public.habits as h
    set last_reminded_on = d.local_day
    from due as d
    -- ponowne sprawdzenie chroni przed podwójnym oznaczeniem przy równoległych wywołaniach
    where h.id = d.id and h.last_reminded_on is distinct from d.local_day
    returning h.id, h.user_id, h.name
  )
  select ps.endpoint, ps.p256dh, ps.auth, cl.id, cl.name
  from claimed as cl
  join public.push_subscriptions as ps on ps.user_id = cl.user_id
$$;

-- Tylko właściciel (cron działa jako postgres)
revoke execute on function public.claim_due_habit_reminders(timestamptz)
  from public, anon, authenticated, service_role;

-- Usuwa wygasłe subskrypcje (404/410 od serwera push). Wywoływana przez endpoint crona
-- kluczem anon, więc sama sprawdza sekret z Vault.
create function public.remove_push_subscriptions(p_secret text, p_endpoints text[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_deleted int;
begin
  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets as ds
  where ds.name = 'rhytm_cron_secret';

  if coalesce(v_secret, '') = '' or p_secret is distinct from v_secret then
    raise exception 'unauthorized';
  end if;

  delete from public.push_subscriptions as ps
  where ps.endpoint = any (p_endpoints);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end
$$;

revoke execute on function public.remove_push_subscriptions(text, text[])
  from public, authenticated, service_role;
grant execute on function public.remove_push_subscriptions(text, text[]) to anon;

-- Zapisuje subskrypcję przeglądarki dla zalogowanego użytkownika. Endpoint jest unikalny globalnie,
-- a RLS ukrywa cudze wiersze, więc gdy w tej samej przeglądarce zaloguje się inny użytkownik,
-- funkcja przejmuje endpoint: usuwa jego dotychczasowy wiersz (czyjkolwiek) i wstawia nowy.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.jwt()->>'sub');
begin
  if v_user_id is null then
    raise exception 'unauthorized';
  end if;

  delete from public.push_subscriptions as ps
  where ps.endpoint = p_endpoint;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_user_id, p_endpoint, p_p256dh, p_auth);
end
$$;

revoke execute on function public.save_push_subscription(text, text, text)
  from public, anon, service_role;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

commit;
