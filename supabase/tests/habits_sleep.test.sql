-- Test etapu 2: nawyki (wersjonowane harmonogramy), odhaczenia, dziennik snu, cel snu w profilu.
begin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"user_a","role":"authenticated"}';

insert into profiles (weight_kg) values (70);
insert into habits (id, name) values ('00000000-0000-0000-0000-0000000000e1', 'Czytanie');
insert into habit_schedules (habit_id, valid_from, schedule_type)
values ('00000000-0000-0000-0000-0000000000e1', '2026-11-01', 'daily');
insert into habit_checks (habit_id, date) values ('00000000-0000-0000-0000-0000000000e1', '2026-11-14');
insert into sleep_logs (date, slept_at, woke_at, feeling, note) values ('2026-11-14', '23:00', '07:00', 4, 'ok');

do $$
begin
  if (select user_id from habits) is distinct from 'user_a' then
    raise exception 'FAIL: habits.user_id nie wzięło domyślnie sub z JWT';
  end if;
  if (select sleep_goal_min from profiles) is distinct from 480 then
    raise exception 'FAIL: profil nie ma sleep_goal_min = 480';
  end if;
  begin
    update profiles set sleep_goal_min = 100;
    raise exception 'FAIL: cel snu 100 przyjęty';
  exception when check_violation then
    null; -- oczekiwane
  end;
  begin
    insert into habit_checks (habit_id, date) values ('00000000-0000-0000-0000-0000000000e1', '2026-11-14');
    raise exception 'FAIL: drugie odhaczenie tego samego dnia przyjęte';
  exception when unique_violation then
    null; -- oczekiwane
  end;
  begin
    insert into habit_schedules (habit_id, valid_from, schedule_type)
    values ('00000000-0000-0000-0000-0000000000e1', '2026-11-02', 'days');
    raise exception 'FAIL: days bez weekdays przyjęte';
  exception when check_violation then
    null; -- oczekiwane
  end;
  begin
    insert into habit_schedules (habit_id, valid_from, schedule_type, weekdays)
    values ('00000000-0000-0000-0000-0000000000e1', '2026-11-02', 'days', '{8}');
    raise exception 'FAIL: days z dniem 8 przyjęte';
  exception when check_violation then
    null; -- oczekiwane
  end;
  begin
    insert into habit_schedules (habit_id, valid_from, schedule_type)
    values ('00000000-0000-0000-0000-0000000000e1', '2026-11-02', 'weekly');
    raise exception 'FAIL: weekly bez times_per_week przyjęte';
  exception when check_violation then
    null; -- oczekiwane
  end;
  begin
    insert into habit_schedules (habit_id, valid_from, schedule_type, times_per_week)
    values ('00000000-0000-0000-0000-0000000000e1', '2026-11-02', 'weekly', 8);
    raise exception 'FAIL: weekly z 8 razami przyjęte';
  exception when check_violation then
    null; -- oczekiwane
  end;
  begin
    insert into sleep_logs (date, slept_at, woke_at, feeling) values ('2026-11-13', '23:00', '07:00', 6);
    raise exception 'FAIL: feeling = 6 przyjęte';
  exception when check_violation then
    null; -- oczekiwane
  end;
  begin
    insert into habits (name) values ('   ');
    raise exception 'FAIL: pusta nazwa nawyku przyjęta';
  exception when check_violation then
    null; -- oczekiwane
  end;
end $$;

-- poprawne warianty harmonogramu
insert into habit_schedules (habit_id, valid_from, schedule_type, weekdays)
values ('00000000-0000-0000-0000-0000000000e1', '2026-11-05', 'days', '{1,3,5}');
insert into habit_schedules (habit_id, valid_from, schedule_type, times_per_week)
values ('00000000-0000-0000-0000-0000000000e1', '2026-11-10', 'weekly', 3);

-- ===== user_b: RLS =====
set local request.jwt.claims = '{"sub":"user_b","role":"authenticated"}';

do $$
begin
  if (select count(*) from habits) <> 0 then raise exception 'FAIL: B widzi nawyk A'; end if;
  if (select count(*) from habit_schedules) <> 0 then raise exception 'FAIL: B widzi wersję harmonogramu A'; end if;
  if (select count(*) from habit_checks) <> 0 then raise exception 'FAIL: B widzi odhaczenie A'; end if;
  if (select count(*) from sleep_logs) <> 0 then raise exception 'FAIL: B widzi wpis snu A'; end if;
  begin
    insert into habit_checks (habit_id, date) values ('00000000-0000-0000-0000-0000000000e1', '2026-11-13');
    raise exception 'FAIL: B dodał odhaczenie do nawyku A';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    insert into habit_schedules (habit_id, valid_from, schedule_type)
    values ('00000000-0000-0000-0000-0000000000e1', '2026-11-20', 'daily');
    raise exception 'FAIL: B dodał wersję harmonogramu do nawyku A';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    insert into habits (user_id, name) values ('user_a', 'Podszyty');
    raise exception 'FAIL: B wstawił nawyk jako user_a';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    insert into sleep_logs (user_id, date, slept_at, woke_at, feeling)
    values ('user_a', '2026-11-12', '23:00', '07:00', 3);
    raise exception 'FAIL: B wstawił sen jako user_a';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  delete from habit_checks;
  update habits set name = 'X';
end $$;

-- ===== A nadal ma swoje dane (B niczego nie zmienił) =====
set local request.jwt.claims = '{"sub":"user_a","role":"authenticated"}';
do $$
begin
  if (select count(*) from habits where name = 'Czytanie') <> 1 then raise exception 'FAIL: A utracił nawyk'; end if;
  if (select count(*) from habit_checks) <> 1 then raise exception 'FAIL: A utracił odhaczenie'; end if;
  if (select count(*) from habit_schedules) <> 3 then raise exception 'FAIL: A nie ma 3 wersji harmonogramu'; end if;
  if (select count(*) from sleep_logs) <> 1 then raise exception 'FAIL: A utracił wpis snu'; end if;
end $$;

do $$ begin raise notice 'HABITS_SLEEP OK'; end $$;
rollback;
