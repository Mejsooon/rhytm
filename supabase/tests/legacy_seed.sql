-- Dane sprzed migracji 0002 (kolumny color): uruchamiane po 0001, przed 0002, jako postgres.
insert into blocks (id, user_id, title, color, start_local, duration_min, timezone) values
  ('00000000-0000-0000-0000-0000000000b1', 'legacy_u', 'Stary niebieski', 'blue',   '2026-11-16 09:00', 60, 'Europe/Warsaw'),
  ('00000000-0000-0000-0000-0000000000b2', 'legacy_u', 'Stary czerwony',  'red',    '2026-11-16 10:00', 60, 'Europe/Warsaw'),
  ('00000000-0000-0000-0000-0000000000b3', 'legacy_u', 'Stary fioletowy', 'purple', '2026-11-16 11:00', 60, 'Europe/Warsaw');
insert into block_exceptions (block_id, occurrence_date, color)
values ('00000000-0000-0000-0000-0000000000b1', '2026-11-23', 'green');
