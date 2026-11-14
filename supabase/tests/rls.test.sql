-- Test RLS: dwóch użytkowników Clerka (user_a, user_b) symulowanych przez JWT.
-- Każda asercja to blok DO, który rzuca wyjątek 'FAIL: ...' przy złym wyniku.
begin;

-- ===== A zakłada dane (user_id ma pochodzić z domyślnej wartości z JWT) =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"user_a","role":"authenticated"}';

insert into profiles (weight_kg) values (70);
insert into categories (id, name, color)
values ('00000000-0000-0000-0000-0000000000a1', 'Kategoria A', 'blue');
insert into blocks (id, title, start_local, duration_min, timezone, category_id)
values ('00000000-0000-0000-0000-00000000000a', 'Blok A', '2026-11-16 09:00', 60, 'Europe/Warsaw',
        '00000000-0000-0000-0000-0000000000a1');
insert into block_exceptions (block_id, occurrence_date, cancelled)
values ('00000000-0000-0000-0000-00000000000a', '2026-11-16', true);
insert into block_tasks (block_id, occurrence_date, title)
values ('00000000-0000-0000-0000-00000000000a', '2026-11-16', 'Zadanie A');

do $$
begin
  if (select user_id from blocks where id = '00000000-0000-0000-0000-00000000000a') is distinct from 'user_a' then
    raise exception 'FAIL: blocks.user_id nie wzięło domyślnie sub z JWT';
  end if;
  if (select user_id from profiles) is distinct from 'user_a' then
    raise exception 'FAIL: profiles.user_id nie wzięło domyślnie sub z JWT';
  end if;
  if (select count(*) from profiles) <> 1 then raise exception 'FAIL: A nie widzi 1 profilu'; end if;
  if (select count(*) from blocks) <> 1 then raise exception 'FAIL: A nie widzi 1 bloku'; end if;
  if (select count(*) from block_exceptions) <> 1 then raise exception 'FAIL: A nie widzi 1 wyjątku'; end if;
  if (select count(*) from block_tasks) <> 1 then raise exception 'FAIL: A nie widzi 1 zadania'; end if;
end $$;

-- ===== B nie widzi i nie rusza danych A =====
set local request.jwt.claims = '{"sub":"user_b","role":"authenticated"}';

do $$
declare
  n bigint;
  affected int;
begin
  select count(*) into n from profiles;
  if n <> 0 then raise exception 'FAIL: B widzi % profili A', n; end if;
  select count(*) into n from blocks;
  if n <> 0 then raise exception 'FAIL: B widzi % bloków A', n; end if;
  select count(*) into n from block_exceptions;
  if n <> 0 then raise exception 'FAIL: B widzi % wyjątków A', n; end if;
  select count(*) into n from block_tasks;
  if n <> 0 then raise exception 'FAIL: B widzi % zadań A', n; end if;

  -- update / delete na wierszach A dotyka 0 wierszy
  update profiles set weight_kg = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B zaktualizował % profili A', affected; end if;
  delete from profiles;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B usunął % profili A', affected; end if;

  update blocks set title = 'hack';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B zaktualizował % bloków A', affected; end if;
  delete from blocks;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B usunął % bloków A', affected; end if;

  update block_exceptions set cancelled = false;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B zaktualizował % wyjątków A', affected; end if;
  delete from block_exceptions;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B usunął % wyjątków A', affected; end if;

  update block_tasks set done = true;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B zaktualizował % zadań A', affected; end if;
  delete from block_tasks;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: B usunął % zadań A', affected; end if;
end $$;

-- B nie może wstawić zadania ani wyjątku do bloku A (oczekiwany błąd RLS 42501)
do $$
begin
  begin
    insert into block_tasks (block_id, occurrence_date, title)
    values ('00000000-0000-0000-0000-00000000000a', '2026-11-17', 'Włam');
    raise exception 'FAIL: B wstawił zadanie do bloku A';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;

  begin
    insert into block_exceptions (block_id, occurrence_date, cancelled)
    values ('00000000-0000-0000-0000-00000000000a', '2026-11-17', true);
    raise exception 'FAIL: B wstawił wyjątek do bloku A';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;

  -- B nie może też podszyć się pod A przez jawny user_id
  begin
    insert into blocks (user_id, title, start_local, duration_min, timezone, category_id)
    values ('user_a', 'Podszyty', '2026-11-16 10:00', 30, 'Europe/Warsaw',
            '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: B wstawił blok jako user_a';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    insert into profiles (user_id) values ('user_a');
    raise exception 'FAIL: B wstawił profil jako user_a';
  exception when insufficient_privilege or unique_violation then
    null; -- oczekiwane
  end;
end $$;

-- ===== Dane A pozostały nienaruszone =====
set local request.jwt.claims = '{"sub":"user_a","role":"authenticated"}';

do $$
begin
  if (select count(*) from profiles) <> 1 then raise exception 'FAIL: A po ataku B nie widzi 1 profilu'; end if;
  if (select count(*) from blocks) <> 1 then raise exception 'FAIL: A po ataku B nie widzi 1 bloku'; end if;
  if (select title from blocks) <> 'Blok A' then raise exception 'FAIL: tytuł bloku A zmieniony'; end if;
  if (select count(*) from block_exceptions) <> 1 then raise exception 'FAIL: A po ataku B nie widzi 1 wyjątku'; end if;
  if (select count(*) from block_tasks) <> 1 then raise exception 'FAIL: A po ataku B nie widzi 1 zadania'; end if;
end $$;

-- anon nie ma dostępu do danych
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from blocks;
    raise exception 'FAIL: anon czyta blocks';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
end $$;

do $$ begin raise notice 'RLS OK'; end $$;
rollback;
