#!/usr/bin/env bash
# Aplica as migrations em um PostgreSQL local descartável e roda os testes de RLS.
# Uso: npm run test:db   (requer psql e um servidor PostgreSQL acessível)
set -euo pipefail
DB="${TEST_DB_NAME:-vilma_test}"
PSQL="${PSQL:-psql}"
CONN="${TEST_DB_URL:-}"
run() { if [ -n "$CONN" ]; then $PSQL "$CONN" -v ON_ERROR_STOP=1 -q "$@"; else su postgres -c "$PSQL -d $DB -v ON_ERROR_STOP=1 -q $(printf '%q ' "$@")"; fi; }
if [ -z "$CONN" ]; then
  su postgres -c "dropdb --if-exists $DB && createdb $DB"
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
run -f "$ROOT/tests/db/supabase-shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ aplicando $(basename "$f")"
  run -f "$f"
done
echo "→ executando tests/db/rls.test.sql"
run -f "$ROOT/tests/db/rls.test.sql"
