#!/usr/bin/env bash
# Odtwarza jednorazową bazę, nakłada shim Supabase, migracje i test RLS.
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
for migration in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$migration"
done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/rls.test.sql
