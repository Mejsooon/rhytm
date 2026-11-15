-- Konfiguracja crona przypomnień push (etap 2b). Uruchom w Supabase → SQL Editor.
-- To NIE jest migracja: lokalna baza testowa nie ma pg_cron ani pg_net.
--
-- Kolejność:
--   1. Zastosuj migrację supabase/migrations/0004_habit_reminders.sql (jeśli jeszcze nie jest zastosowana).
--   2. Utwórz sekrety w Vault (jednorazowo, wartości wpisujesz sam, nigdy ich nie wklejaj do repo ani czatu):
--        select vault.create_secret('<ta sama wartość co CRON_SECRET w Vercelu>', 'rhytm_cron_secret');
--        select vault.create_secret('https://<adres aplikacji na Vercelu>', 'rhytm_app_url');
--      Adres bez ukośnika na końcu. Zmiana wartości później: vault.update_secret(...) albo edycja w Dashboard → Vault.
--   3. Uruchom ten plik. Można go uruchamiać wielokrotnie.
--
-- Co robi job: co minutę woła public.claim_due_habit_reminders(now()) (zwraca nawyki, których przypomnienie
-- właśnie wypada, i oznacza je jako przypomniane) i wysyła wynik POST-em do /api/cron/przypomnienia.
-- Gdy nic nie wypada, funkcja zwraca zero wierszy, "having count(*) > 0" daje brak wyniku i żadne zapytanie HTTP nie wychodzi.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Ponowne uruchomienie: usuń stary job, jeśli istnieje.
select cron.unschedule('rhytm-przypomnienia')
where exists (
  select 1 from cron.job as j where j.jobname = 'rhytm-przypomnienia'
);

select cron.schedule(
  'rhytm-przypomnienia',
  '* * * * *',
  $$
  with due as (
    select * from public.claim_due_habit_reminders(now())
  )
  select net.http_post(
    url := (select ds.decrypted_secret from vault.decrypted_secrets as ds where ds.name = 'rhytm_app_url')
      || '/api/cron/przypomnienia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select ds.decrypted_secret from vault.decrypted_secrets as ds where ds.name = 'rhytm_cron_secret'
      )
    ),
    body := jsonb_build_object('reminders', jsonb_agg(to_jsonb(due))),
    timeout_milliseconds := 10000
  )
  from due
  having count(*) > 0;
  $$
);
