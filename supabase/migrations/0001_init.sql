-- Rhytm: profile użytkowników + kalendarz główny. Tożsamość z Clerka (JWT sub).

create table profiles (
  user_id text primary key default (auth.jwt()->>'sub'),
  weight_kg numeric null,
  height_cm numeric null,
  birth_date date null,
  sex text null check (sex in ('M', 'K')),
  timezone text not null default 'Europe/Warsaw'
);

create table blocks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub'),
  title text not null check (length(trim(title)) > 0),
  color text not null default 'blue',
  note text null,
  start_local timestamp not null,
  duration_min int not null check (duration_min between 5 and 1440),
  timezone text not null,
  recurrence jsonb null,
  created_at timestamptz default now()
);
create index blocks_user_id_idx on blocks (user_id);

create table block_exceptions (
  block_id uuid not null references blocks (id) on delete cascade,
  occurrence_date date not null,
  cancelled bool not null default false,
  start_local timestamp null,
  duration_min int null,
  title text null,
  color text null,
  note text null,
  primary key (block_id, occurrence_date)
);

create table block_tasks (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references blocks (id) on delete cascade,
  occurrence_date date not null,
  title text not null,
  done bool not null default false,
  position int not null default 0
);
create index block_tasks_block_occurrence_idx on block_tasks (block_id, occurrence_date);

grant select, insert, update, delete
  on profiles, blocks, block_exceptions, block_tasks to authenticated;

alter table profiles enable row level security;
alter table blocks enable row level security;
alter table block_exceptions enable row level security;
alter table block_tasks enable row level security;

create policy profiles_own on profiles for all to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));

create policy blocks_own on blocks for all to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));

create policy block_exceptions_own on block_exceptions for all to authenticated
  using (exists (
    select 1 from blocks b
    where b.id = block_id and b.user_id = (select auth.jwt()->>'sub')))
  with check (exists (
    select 1 from blocks b
    where b.id = block_id and b.user_id = (select auth.jwt()->>'sub')));

create policy block_tasks_own on block_tasks for all to authenticated
  using (exists (
    select 1 from blocks b
    where b.id = block_id and b.user_id = (select auth.jwt()->>'sub')))
  with check (exists (
    select 1 from blocks b
    where b.id = block_id and b.user_id = (select auth.jwt()->>'sub')));
