-- Rhytm etap 1b: kategorie bloków. Zastępują kolumny color w blocks i block_exceptions.
-- Istniejące kolory zamieniane są na kategorie (red → rose, purple → violet, nieznane → gray).
begin;

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub'),
  name text not null check (length(trim(name)) between 1 and 40),
  color text not null check (color in ('blue','teal','gray','rose','orange','violet','green','amber')),
  position int not null default 0,
  visible bool not null default true,
  is_system bool not null default false,
  created_at timestamptz default now()
);
create unique index categories_user_name_idx on categories (user_id, lower(trim(name)));

grant select, insert, update, delete on categories to authenticated;
alter table categories enable row level security;

create policy categories_own on categories for all to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));

-- ===== Migracja danych: jedna kategoria na parę (użytkownik, kolor po mapowaniu) =====
alter table blocks add column category_id uuid null references categories (id) on delete restrict;
alter table block_exceptions add column category_id uuid null references categories (id) on delete restrict;

-- Jedyne miejsce mapowania starych kolorów (nieznane i null -> gray) oraz kolejności/etykiet palety
create temp table legacy_color_map (old_color text primary key, new_color text not null) on commit drop;
insert into legacy_color_map (old_color, new_color) values
  ('blue','blue'), ('green','green'), ('orange','orange'), ('gray','gray'),
  ('red','rose'), ('purple','violet');

create temp table palette (color text primary key, label text not null, pos int not null) on commit drop;
insert into palette (color, label, pos) values
  ('blue','Niebieski',0), ('teal','Morski',1), ('gray','Szary',2), ('rose','Różowy',3),
  ('orange','Pomarańczowy',4), ('violet','Fioletowy',5), ('green','Zielony',6), ('amber','Bursztynowy',7);

create temp table legacy_pairs on commit drop as
select b.user_id, coalesce(m.new_color, 'gray') as color
from blocks as b
left join legacy_color_map as m on m.old_color = b.color
union
select b.user_id, coalesce(m.new_color, 'gray')
from block_exceptions as e
join blocks as b on b.id = e.block_id
left join legacy_color_map as m on m.old_color = e.color
where e.color is not null;

insert into categories (user_id, name, color, position)
select lp.user_id, p.label, lp.color,
       (row_number() over (partition by lp.user_id order by p.pos)) - 1
from legacy_pairs as lp
join palette as p on p.color = lp.color;

update blocks as b
set category_id = c.id
from categories as c
where c.user_id = b.user_id
  and c.color = coalesce((select m.new_color from legacy_color_map as m where m.old_color = b.color), 'gray');

update block_exceptions as e
set category_id = c.id
from blocks as b, categories as c
where b.id = e.block_id
  and e.color is not null
  and c.user_id = b.user_id
  and c.color = coalesce((select m.new_color from legacy_color_map as m where m.old_color = e.color), 'gray');

alter table blocks alter column category_id set not null;
alter table blocks drop column color;
alter table block_exceptions drop column color;
create index blocks_category_id_idx on blocks (category_id);

-- ===== Polityki: kategoria musi należeć do tego samego użytkownika =====
drop policy blocks_own on blocks;
create policy blocks_own on blocks for all to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (
    user_id = (select auth.jwt()->>'sub')
    and exists (
      select 1 from categories as c
      where c.id = category_id and c.user_id = (select auth.jwt()->>'sub')));

drop policy block_exceptions_own on block_exceptions;
create policy block_exceptions_own on block_exceptions for all to authenticated
  using (exists (
    select 1 from blocks as b
    where b.id = block_id and b.user_id = (select auth.jwt()->>'sub')))
  with check (
    exists (
      select 1 from blocks as b
      where b.id = block_id and b.user_id = (select auth.jwt()->>'sub'))
    and (
      category_id is null
      or exists (
        select 1 from categories as c
        where c.id = category_id and c.user_id = (select auth.jwt()->>'sub'))));

commit;
