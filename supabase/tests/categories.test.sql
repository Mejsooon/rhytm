-- Test kategorii: migracja danych z legacy_seed.sql, unikalność nazw, RLS.
begin;

-- ===== Migracja danych legacy_u (jako postgres, bez RLS) =====
do $$
begin
  if (select count(*) from categories where user_id = 'legacy_u') <> 4 then
    raise exception 'FAIL: legacy_u nie ma dokładnie 4 kategorii';
  end if;
  if (select array_agg(color order by color) from categories where user_id = 'legacy_u')
     is distinct from array['blue','green','rose','violet'] then
    raise exception 'FAIL: kolory kategorii legacy_u inne niż {blue, rose, violet, green}';
  end if;
  if (select array_agg(name order by color) from categories where user_id = 'legacy_u')
     is distinct from array['Niebieski','Zielony','Różowy','Fioletowy'] then
    raise exception 'FAIL: nazwy kategorii legacy_u niepoprawne';
  end if;
  if (select c.color from blocks as b join categories as c on c.id = b.category_id
      where b.id = '00000000-0000-0000-0000-0000000000b2') is distinct from 'rose' then
    raise exception 'FAIL: blok dawniej red nie wskazuje na rose';
  end if;
  if (select c.color from blocks as b join categories as c on c.id = b.category_id
      where b.id = '00000000-0000-0000-0000-0000000000b3') is distinct from 'violet' then
    raise exception 'FAIL: blok dawniej purple nie wskazuje na violet';
  end if;
  if (select c.color from blocks as b join categories as c on c.id = b.category_id
      where b.id = '00000000-0000-0000-0000-0000000000b1') is distinct from 'blue' then
    raise exception 'FAIL: blok dawniej blue nie wskazuje na blue';
  end if;
  if (select c.color from block_exceptions as e join categories as c on c.id = e.category_id
      where e.block_id = '00000000-0000-0000-0000-0000000000b1') is distinct from 'green' then
    raise exception 'FAIL: wyjątek dawniej green nie wskazuje na green';
  end if;
  if exists (select 1 from information_schema.columns
             where table_name in ('blocks','block_exceptions') and column_name = 'color') then
    raise exception 'FAIL: kolumna color nadal istnieje';
  end if;
end $$;

-- ===== user_a: unikalność nazw bez względu na wielkość liter i spacje =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"user_a","role":"authenticated"}';

insert into categories (id, name, color)
values ('00000000-0000-0000-0000-0000000000c1', 'Nauka', 'blue');

do $$
begin
  begin
    insert into categories (name, color) values (' nauka ', 'teal');
    raise exception 'FAIL: wstawiono duplikat nazwy " nauka "';
  exception when unique_violation then
    null; -- oczekiwane
  end;
  begin
    insert into categories (name, color) values ('   ', 'teal');
    raise exception 'FAIL: wstawiono pustą nazwę';
  exception when check_violation then
    null; -- oczekiwane
  end;
  begin
    insert into categories (name, color) values ('Inna', 'pink');
    raise exception 'FAIL: wstawiono kolor spoza palety';
  exception when check_violation then
    null; -- oczekiwane
  end;
end $$;

-- ===== user_b: RLS =====
set local request.jwt.claims = '{"sub":"user_b","role":"authenticated"}';

do $$
begin
  if (select count(*) from categories) <> 0 then
    raise exception 'FAIL: B widzi kategorie A lub legacy_u';
  end if;
  begin
    insert into blocks (title, start_local, duration_min, timezone, category_id)
    values ('Włam', '2026-11-16 09:00', 60, 'Europe/Warsaw', '00000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL: B wstawił blok z kategorią A';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    insert into categories (user_id, name, color) values ('user_a', 'Podszyta', 'gray');
    raise exception 'FAIL: B wstawił kategorię jako user_a';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
end $$;

-- B ma własną kategorię, a wyjątek z cudzą kategorią jest odrzucany
insert into categories (id, name, color)
values ('00000000-0000-0000-0000-0000000000c2', 'Nauka', 'blue'); -- ta sama nazwa co u A: dozwolone
insert into blocks (id, title, start_local, duration_min, timezone, category_id)
values ('00000000-0000-0000-0000-0000000000d2', 'Blok B', '2026-11-16 09:00', 60, 'Europe/Warsaw',
        '00000000-0000-0000-0000-0000000000c2');

do $$
begin
  begin
    insert into block_exceptions (block_id, occurrence_date, category_id)
    values ('00000000-0000-0000-0000-0000000000d2', '2026-11-17', '00000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL: B wstawił wyjątek z kategorią A';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
  begin
    update blocks set category_id = '00000000-0000-0000-0000-0000000000c1'
    where id = '00000000-0000-0000-0000-0000000000d2';
    raise exception 'FAIL: B przepiął własny blok na kategorię A';
  exception when insufficient_privilege then
    null; -- oczekiwane
  end;
end $$;

-- ===== A nadal widzi tylko swoją kategorię =====
set local request.jwt.claims = '{"sub":"user_a","role":"authenticated"}';
do $$
begin
  if (select count(*) from categories) <> 1 then
    raise exception 'FAIL: A nie widzi dokładnie 1 swojej kategorii';
  end if;
end $$;

do $$ begin raise notice 'CATEGORIES OK'; end $$;
rollback;
