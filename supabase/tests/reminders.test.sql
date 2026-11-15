-- Test etapu 2b: przypomnienia nawyków (claim_due_habit_reminders), subskrypcje push, usuwanie martwych subskrypcji.
begin;

-- ===== dane (jako właściciel bazy, z jawnym user_id) =====
-- u3 ma nieznaną strefę (profiles.timezone to wolny tekst): nie może zablokować przypomnień innym
insert into profiles (user_id, timezone) values ('u1', 'Europe/Warsaw'), ('u2', 'Europe/Warsaw'), ('u3', 'X/Y');

insert into push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('u1', 'https://push.example/u1-telefon', 'p256dh-1', 'auth-1'),
  ('u1', 'https://push.example/u1-laptop', 'p256dh-2', 'auth-2'),
  ('u3', 'https://push.example/u3-telefon', 'p256dh-3', 'auth-3');

insert into vault.decrypted_secrets (name, decrypted_secret) values ('rhytm_cron_secret', 'dobry-sekret');

-- A daily, B pn, C weekly 2 (2 odhaczenia w tym tygodniu), D none z wymuszonym remind_at,
-- E daily odhaczony dziś, F daily zarchiwizowany, G daily zaczyna się po dziś (ruling D), U2 nawyk u2
insert into habits (id, user_id, name, remind_at, archived_at) values
  ('00000000-0000-0000-0000-00000000000a', 'u1', 'A', '08:00', null),
  ('00000000-0000-0000-0000-00000000000b', 'u1', 'B', '08:00', null),
  ('00000000-0000-0000-0000-00000000000c', 'u1', 'C', '08:00', null),
  ('00000000-0000-0000-0000-00000000000d', 'u1', 'D', '08:00', null),
  ('00000000-0000-0000-0000-00000000000e', 'u1', 'E', '08:00', null),
  ('00000000-0000-0000-0000-00000000000f', 'u1', 'F', '08:00', '2026-11-01'),
  ('00000000-0000-0000-0000-000000000010', 'u1', 'G', '08:00', null),
  ('00000000-0000-0000-0000-000000000020', 'u2', 'U2', '08:00', null),
  ('00000000-0000-0000-0000-000000000030', 'u3', 'U3', '08:00', null);

insert into habit_schedules (habit_id, valid_from, schedule_type, weekdays, times_per_week) values
  ('00000000-0000-0000-0000-00000000000a', '2026-01-01', 'daily', null, null),
  ('00000000-0000-0000-0000-00000000000b', '2026-01-01', 'days', '{1}', null),
  ('00000000-0000-0000-0000-00000000000c', '2026-01-01', 'weekly', null, 2),
  ('00000000-0000-0000-0000-00000000000d', '2026-01-01', 'none', null, null),
  ('00000000-0000-0000-0000-00000000000e', '2026-01-01', 'daily', null, null),
  ('00000000-0000-0000-0000-00000000000f', '2026-01-01', 'daily', null, null),
  ('00000000-0000-0000-0000-000000000010', '2026-12-01', 'daily', null, null),
  ('00000000-0000-0000-0000-000000000020', '2026-01-01', 'daily', null, null),
  ('00000000-0000-0000-0000-000000000030', '2026-01-01', 'daily', null, null);

insert into habit_checks (habit_id, date) values
  ('00000000-0000-0000-0000-00000000000c', '2026-11-16'),
  ('00000000-0000-0000-0000-00000000000c', '2026-11-19'),
  ('00000000-0000-0000-0000-00000000000e', '2026-11-17');

-- ===== wtorek 2026-11-17 08:05 w Warszawie =====
do $$
declare
  v_rows int;
  v_a_rows int;
begin
  select count(*), count(*) filter (where habit_id = '00000000-0000-0000-0000-00000000000a' and habit_name = 'A')
    into v_rows, v_a_rows
    from claim_due_habit_reminders('2026-11-17 07:05+00');
  if v_rows <> 2 or v_a_rows <> 2 then
    raise exception 'FAIL: wtorek 08:05 zwrócił % wierszy (% dla A), oczekiwane 2 dla A', v_rows, v_a_rows;
  end if;
  if (select count(*) from claim_due_habit_reminders('2026-11-17 07:05+00')) <> 0 then
    raise exception 'FAIL: drugie wywołanie w tym samym oknie coś zwróciło';
  end if;
  if (select last_reminded_on from habits where id = '00000000-0000-0000-0000-00000000000a') is distinct from '2026-11-17' then
    raise exception 'FAIL: A nie ma last_reminded_on = 2026-11-17';
  end if;
  if (select last_reminded_on from habits where id = '00000000-0000-0000-0000-000000000020') is not null then
    raise exception 'FAIL: nawyk u2 (bez subskrypcji) oznaczony jako przypomniany';
  end if;
  if (select last_reminded_on from habits where id = '00000000-0000-0000-0000-000000000030') is not null then
    raise exception 'FAIL: nawyk u3 (nieznana strefa) oznaczony jako przypomniany';
  end if;
end $$;

-- ===== okno 15 minut: świeży nawyk H 08:00 =====
insert into habits (id, user_id, name, remind_at) values ('00000000-0000-0000-0000-000000000011', 'u1', 'H', '08:00');
insert into habit_schedules (habit_id, valid_from, schedule_type) values ('00000000-0000-0000-0000-000000000011', '2026-01-01', 'daily');

do $$
begin
  if (select count(*) from claim_due_habit_reminders('2026-11-17 06:59+00')) <> 0 then
    raise exception 'FAIL: 07:59 lokalnie coś zwróciło';
  end if;
  if (select count(*) from claim_due_habit_reminders('2026-11-17 07:15+00')) <> 0 then
    raise exception 'FAIL: 08:15 lokalnie (koniec okna) coś zwróciło';
  end if;
  if (select count(*) from claim_due_habit_reminders('2026-11-17 07:14+00')
      where habit_id = '00000000-0000-0000-0000-000000000011') <> 2 then
    raise exception 'FAIL: 08:14 lokalnie nie zwróciło H';
  end if;
end $$;

-- ===== tydzień ISO dla weekly: odhaczenia z niedzieli 11-15 i poniedziałku 11-23 należą do innych tygodni =====
insert into habits (id, user_id, name, remind_at) values ('00000000-0000-0000-0000-000000000012', 'u1', 'W', '09:00');
insert into habit_schedules (habit_id, valid_from, schedule_type, times_per_week)
values ('00000000-0000-0000-0000-000000000012', '2026-01-01', 'weekly', 2);
insert into habit_checks (habit_id, date) values
  ('00000000-0000-0000-0000-000000000012', '2026-11-15'),
  ('00000000-0000-0000-0000-000000000012', '2026-11-16'),
  ('00000000-0000-0000-0000-000000000012', '2026-11-23');

do $$
begin
  if (select count(*) from claim_due_habit_reminders('2026-11-17 08:05+00')
      where habit_id = '00000000-0000-0000-0000-000000000012') <> 2 then
    raise exception 'FAIL: weekly z 1 odhaczeniem w tym tygodniu nie dostał przypomnienia';
  end if;
end $$;

-- ===== zmiana czasu i poniedziałek =====
do $$
begin
  if not exists (select 1 from claim_due_habit_reminders('2026-03-29 06:00+00')
                 where habit_id = '00000000-0000-0000-0000-00000000000a') then
    raise exception 'FAIL: 2026-03-29 06:00 UTC (08:00 CEST) nie zwróciło A';
  end if;
  if not exists (select 1 from claim_due_habit_reminders('2026-11-16 07:05+00')
                 where habit_id = '00000000-0000-0000-0000-00000000000b') then
    raise exception 'FAIL: poniedziałek 08:05 nie zwrócił B';
  end if;
  if (select last_reminded_on from habits where id = '00000000-0000-0000-0000-000000000020') is not null then
    raise exception 'FAIL: nawyk u2 (bez subskrypcji) oznaczony jako przypomniany';
  end if;
end $$;

-- ===== uprawnienia: authenticated i anon nie wywołają claim =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"u1","role":"authenticated"}';
do $$
begin
  begin
    perform claim_due_habit_reminders('2026-11-17 07:05+00');
    raise exception 'FAIL: authenticated wywołał claim_due_habit_reminders';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    perform remove_push_subscriptions('dobry-sekret', array['https://push.example/u1-laptop']);
    raise exception 'FAIL: authenticated wywołał remove_push_subscriptions';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
end $$;
reset role;

-- ===== anon: usuwanie subskrypcji tylko z poprawnym sekretem =====
set local role anon;
do $$
declare
  v_deleted int;
begin
  begin
    perform claim_due_habit_reminders('2026-11-17 07:05+00');
    raise exception 'FAIL: anon wywołał claim_due_habit_reminders';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    perform 1 from vault.decrypted_secrets;
    raise exception 'FAIL: anon czyta vault.decrypted_secrets';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    perform 1 from push_subscriptions;
    raise exception 'FAIL: anon czyta push_subscriptions';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    perform remove_push_subscriptions('zly', array['https://push.example/u1-laptop']);
    raise exception 'FAIL: zły sekret przyjęty';
  exception when raise_exception then
    if sqlerrm <> 'unauthorized' then raise; end if;
  end;
  begin
    perform remove_push_subscriptions(null, array['https://push.example/u1-laptop']);
    raise exception 'FAIL: pusty sekret przyjęty';
  exception when raise_exception then
    if sqlerrm <> 'unauthorized' then raise; end if;
  end;
  v_deleted := remove_push_subscriptions('dobry-sekret', array['https://push.example/u1-laptop', 'https://push.example/nieznany']);
  if v_deleted <> 1 then
    raise exception 'FAIL: poprawny sekret usunął % subskrypcji, oczekiwane 1', v_deleted;
  end if;
end $$;
reset role;

-- ===== bez sekretu w Vault każde wywołanie jest odrzucane =====
delete from vault.decrypted_secrets where name = 'rhytm_cron_secret';
set local role anon;
do $$
begin
  begin
    perform remove_push_subscriptions('dobry-sekret', array['https://push.example/u1-telefon']);
    raise exception 'FAIL: usunięcie bez sekretu w Vault przyjęte';
  exception when raise_exception then
    if sqlerrm <> 'unauthorized' then raise; end if;
  end;
end $$;
reset role;

-- ===== push_subscriptions: authenticated tylko czyta i usuwa swoje, zapis wyłącznie przez funkcję =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"u2","role":"authenticated"}';
do $$
begin
  if (select count(*) from push_subscriptions) <> 0 then raise exception 'FAIL: u2 widzi subskrypcje u1'; end if;
  begin
    insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('u1', 'https://fcm.googleapis.com/podszyta', 'p', 'a');
    raise exception 'FAIL: u2 wstawił subskrypcję jako u1';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    insert into push_subscriptions (endpoint, p256dh, auth) values ('http://169.254.169.254/x', 'p', 'a');
    raise exception 'FAIL: authenticated wstawił subskrypcję bezpośrednio (z pominięciem save_push_subscription)';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  delete from push_subscriptions;
  perform save_push_subscription('https://fcm.googleapis.com/fcm/send/u2-telefon', 'p', 'a');
  if (select user_id from push_subscriptions) is distinct from 'u2' then
    raise exception 'FAIL: save_push_subscription nie zapisał subskrypcji jako u2';
  end if;
end $$;

set local request.jwt.claims = '{"sub":"u1","role":"authenticated"}';
do $$
begin
  if (select count(*) from push_subscriptions) <> 1 then
    raise exception 'FAIL: u1 nie widzi dokładnie swojej 1 pozostałej subskrypcji';
  end if;
end $$;

-- ===== save_push_subscription: lista dozwolonych serwerów push i limity długości =====
do $$
declare
  v_endpoint text;
  v_bad record;
begin
  foreach v_endpoint in array array[
    'https://fcm.googleapis.com/fcm/send/ok-1',
    'https://updates.push.services.mozilla.com/wpush/v2/ok-2',
    'https://web.push.apple.com/ok-3',
    'https://api.push.apple.com/ok-4',
    'https://wns2-db5p.notify.windows.com/w/?token=ok-5',
    'https://FCM.GoogleAPIs.com/fcm/send/ok-6'
  ] loop
    perform save_push_subscription(v_endpoint, 'p', 'a');
  end loop;
  if (select count(*) from push_subscriptions where endpoint like '%ok-%') <> 6 then
    raise exception 'FAIL: nie wszystkie dozwolone endpointy zostały zapisane';
  end if;

  for v_bad in
    select * from (values
      ('http://169.254.169.254/x', 'p', 'a'),
      ('http://fcm.googleapis.com/x', 'p', 'a'),
      ('https://evil.example/x', 'p', 'a'),
      ('https://fcm.googleapis.com.evil.com/x', 'p', 'a'),
      ('https://user@fcm.googleapis.com/x', 'p', 'a'),
      ('https://x@api.push.apple.com/x', 'p', 'a'),
      ('https://fcm.googleapis.com:8443/x', 'p', 'a'),
      ('https://evil.com\.push.apple.com/x', 'p', 'a'),
      ('https://.push.apple.com/x', 'p', 'a'),
      ('https://push.apple.com/x', 'p', 'a'),
      ('https://fcm.googleapis.com/x', 'p', repeat('a', 1001)),
      ('https://fcm.googleapis.com/x', '', 'a'),
      ('https://fcm.googleapis.com/x', 'p', null),
      ('https://fcm.googleapis.com/' || repeat('a', 980), 'p', 'a')
    ) as t (endpoint, p256dh, auth)
  loop
    begin
      perform save_push_subscription(v_bad.endpoint, v_bad.p256dh, v_bad.auth);
      raise exception 'FAIL: przyjęto niedozwoloną subskrypcję %', left(v_bad.endpoint, 60);
    exception when raise_exception then
      if sqlerrm <> 'invalid subscription' then raise; end if;
    end;
  end loop;
end $$;
reset role;

-- CHECK pilnuje limitów długości także dla zapisu z pominięciem funkcji (np. właściciel bazy)
do $$
begin
  begin
    insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('u1', 'https://fcm.googleapis.com/dlugi', 'p', repeat('a', 1001));
    raise exception 'FAIL: CHECK przepuścił auth o 1001 znakach';
  exception when check_violation then
    null; -- oczekiwane
  end;
  begin
    insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('u1', 'https://fcm.googleapis.com/pusty', '', 'a');
    raise exception 'FAIL: CHECK przepuścił puste p256dh';
  exception when check_violation then
    null; -- oczekiwane
  end;
end $$;

-- ===== save_push_subscription: przejęcie endpointu przez innego użytkownika =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"u1","role":"authenticated"}';
do $$
begin
  perform save_push_subscription('https://fcm.googleapis.com/wspolny', 'p-u1', 'a-u1');
end $$;
set local request.jwt.claims = '{"sub":"u2","role":"authenticated"}';
do $$
begin
  perform save_push_subscription('https://fcm.googleapis.com/wspolny', 'p-u2', 'a-u2');
end $$;
set local request.jwt.claims = '{"role":"authenticated"}';
do $$
begin
  begin
    perform save_push_subscription('https://fcm.googleapis.com/bez-sub', 'p', 'a');
    raise exception 'FAIL: zapis subskrypcji bez sub przyjęty';
  exception when raise_exception then
    if sqlerrm <> 'unauthorized' then raise; end if;
  end;
end $$;
reset role;

do $$
begin
  if (select count(*) from push_subscriptions where endpoint = 'https://fcm.googleapis.com/wspolny') <> 1 then
    raise exception 'FAIL: wspólny endpoint nie ma dokładnie 1 wiersza';
  end if;
  if (select user_id || '/' || p256dh || '/' || auth from push_subscriptions
      where endpoint = 'https://fcm.googleapis.com/wspolny') is distinct from 'u2/p-u2/a-u2' then
    raise exception 'FAIL: wspólny endpoint nie należy do u2 z jego kluczami';
  end if;
  if exists (select 1 from push_subscriptions where endpoint = 'https://fcm.googleapis.com/bez-sub') then
    raise exception 'FAIL: zapisano subskrypcję bez sub';
  end if;
end $$;

set local role anon;
do $$
begin
  begin
    perform save_push_subscription('https://fcm.googleapis.com/anon', 'p', 'a');
    raise exception 'FAIL: anon wywołał save_push_subscription';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
end $$;
reset role;

do $$ begin raise notice 'REMINDERS OK'; end $$;
rollback;
