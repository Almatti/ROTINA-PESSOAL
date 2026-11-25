#!/usr/bin/env bash
# Testes end-to-end com backend real (PostgreSQL + RLS) via shim local do Supabase.
# Requer PostgreSQL local (usuário postgres via socket) e Chromium do Playwright.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export TEST_DB_NAME=vilma_e2e
echo "→ preparando banco $TEST_DB_NAME"
su postgres -c "dropdb --if-exists $TEST_DB_NAME && createdb $TEST_DB_NAME"
for f in tests/db/supabase-shim.sql supabase/migrations/*.sql; do su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $TEST_DB_NAME -f $f" >/dev/null; done
# senha local apenas para o banco de teste (conexão TCP do shim)
su postgres -c "psql -q -c \"alter user postgres password 'postgres'\"" >/dev/null
export SHIM_DB_URL="${SHIM_DB_URL:-postgresql://postgres:postgres@127.0.0.1:5432/$TEST_DB_NAME}"
KEYS=$(node tests/e2e/supabase-shim/server.mjs --keys)
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(node -e "console.log(JSON.parse(process.argv[1]).ANON_KEY)" "$KEYS")
export SUPABASE_SERVICE_ROLE_KEY=$(node -e "console.log(JSON.parse(process.argv[1]).SERVICE_KEY)" "$KEYS")
export NEXT_PUBLIC_SITE_URL="http://localhost:3100"
export NEXT_TELEMETRY_DISABLED=1
unset ANTHROPIC_API_KEY || true
if [ "${SKIP_BUILD:-0}" != "1" ]; then echo "→ build"; npx next build >/dev/null; fi
echo "→ playwright"
npx playwright test --trace off "$@"
