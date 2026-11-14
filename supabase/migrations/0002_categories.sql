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

with legacy as (
  select b.user_id,
         case b.color when 'red' then 'rose' when 'purple' then 'violet'
           when 'blue' then 'blue' when 'green' then 'green'
           when 'orange' then 'orange' else 'gray' end as color
  from blocks as b
  union
  select b.user_id,
         case e.color when 'red' then 'rose' when 'purple' then 'violet'
           when 'blue' then 'blue' when 'green' then 'green'
           when 'orange' then 'orange' else 'gray' end as color
  from block_exceptions as e
  join blocks as b on b.id = e.block_id
  where e.color is not null
)
insert into categories (user_id, name, color, position)
select l.user_id,
       case l.color when 'blue' then 'Niebieski' when 'teal' then 'Morski'
         when 'gray' then 'Szary' when 'rose' then 'Różowy'
         when 'orange' then 'Pomarańczowy' when 'violet' then 'Fioletowy'
         when 'green' then 'Zielony' else 'Bursztynowy' end,
       l.color,
       (row_number() over (partition by l.user_id order by l.color)) - 1
from legacy as l;

update blocks as b
set category_id = c.id
from categories as c
where c.user_id = b.user_id
  and c.color = case b.color when 'red' then 'rose' when 'purple' then 'violet'
    when 'blue' then 'blue' when 'green' then 'green'
    when 'orange' then 'orange' else 'gray' end;

update block_exceptions as e
set category_id = c.id
from blocks as b, categories as c
where b.id = e.block_id
  and e.color is not null
  and c.user_id = b.user_id
  and c.color = case e.color when 'red' then 'rose' when 'purple' then 'violet'
    when 'blue' then 'blue' when 'green' then 'green'
    when 'orange' then 'orange' else 'gray' end;

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
