#!/usr/bin/env bash
# Odtwarza jednorazową bazę, nakłada shim Supabase, migracje, dane legacy, testy RLS i kategorii.
set -euo pipefail
cd "$(dirname "$0")/.."

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
DB="${TEST_DB_NAME:-rhytm_test}"

dropdb --if-exists --force "$DB"
createdb "$DB"

psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/00_shim.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/migrations/0001_init.sql
# dane sprzed migracji kategorii: sprawdzają, że 0002 nic nie gubi
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/legacy_seed.sql
for migration in supabase/migrations/*.sql; do
  [ "$(basename "$migration")" = "0001_init.sql" ] && continue
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$migration"
done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/rls.test.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/categories.test.sql
