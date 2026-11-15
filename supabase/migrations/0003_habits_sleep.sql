-- Rhytm etap 2: nawyki z wersjonowanym harmonogramem, odhaczenia, dziennik snu, cel snu w profilu.
begin;

create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub'),
  name text not null check (length(trim(name)) between 1 and 60),
  position int not null default 0,
  archived_at date null,
  created_at timestamptz default now()
);
create index habits_user_id_idx on habits (user_id);

-- Wersje harmonogramu: obowiązuje wersja z największym valid_from <= dzień
create table habit_schedules (
  habit_id uuid not null references habits (id) on delete cascade,
  valid_from date not null,
  schedule_type text not null check (schedule_type in ('daily','days','weekly','none')),
  weekdays int[] null,
  times_per_week int null check (times_per_week between 1 and 7),
  primary key (habit_id, valid_from),
  constraint habit_schedules_type_fields check (
    (schedule_type <> 'days'
      or (weekdays is not null
          and cardinality(weekdays) >= 1
          and weekdays <@ array[1,2,3,4,5,6,7]))
    and (schedule_type <> 'weekly' or times_per_week is not null))
);

create table habit_checks (
  habit_id uuid not null references habits (id) on delete cascade,
  date date not null,
  primary key (habit_id, date)
);

-- Wpis snu na dzień pobudki
create table sleep_logs (
  user_id text not null default (auth.jwt()->>'sub'),
  date date not null,
  slept_at time not null,
  woke_at time not null,
  feeling int not null check (feeling between 1 and 5),
  note text null check (note is null or length(note) <= 500),
  primary key (user_id, date)
);

alter table profiles
  add column sleep_goal_min int not null default 480 check (sleep_goal_min between 240 and 720);

grant select, insert, update, delete
  on habits, habit_schedules, habit_checks, sleep_logs to authenticated;

alter table habits enable row level security;
alter table habit_schedules enable row level security;
alter table habit_checks enable row level security;
alter table sleep_logs enable row level security;

create policy habits_own on habits for all to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));

create policy sleep_logs_own on sleep_logs for all to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));

create policy habit_schedules_own on habit_schedules for all to authenticated
  using (exists (
    select 1 from habits as h
    where h.id = habit_id and h.user_id = (select auth.jwt()->>'sub')))
  with check (exists (
    select 1 from habits as h
    where h.id = habit_id and h.user_id = (select auth.jwt()->>'sub')));

create policy habit_checks_own on habit_checks for all to authenticated
  using (exists (
    select 1 from habits as h
    where h.id = habit_id and h.user_id = (select auth.jwt()->>'sub')))
  with check (exists (
    select 1 from habits as h
    where h.id = habit_id and h.user_id = (select auth.jwt()->>'sub')));

commit;
