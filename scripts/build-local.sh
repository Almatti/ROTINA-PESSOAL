#!/usr/bin/env bash
# Gera a versão "modo local" (site estático em ./out), sem servidor nem Supabase.
# Os dados ficam no navegador do aparelho. Uso:
#   npm run build:local                      # para servir na raiz (/)
#   NEXT_PUBLIC_BASE_PATH=/ROTINA-PESSOAL npm run build:local   # GitHub Pages
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/gen-local-schema.mjs
STASH=".local-build-stash"
rm -rf "$STASH" && mkdir -p "$STASH"
restore() {
  for p in api auth configuracao; do [ -e "$STASH/$p" ] && mv "$STASH/$p" "src/app/$p"; done
  [ -e "$STASH/middleware.ts" ] && mv "$STASH/middleware.ts" src/middleware.ts
  rm -rf "$STASH"
}
trap restore EXIT
# rotas que exigem servidor não existem no modo local
for p in api auth configuracao; do mv "src/app/$p" "$STASH/$p"; done
mv src/middleware.ts "$STASH/middleware.ts"
rm -rf .next out
NEXT_PUBLIC_LOCAL_MODE=1 NEXT_TELEMETRY_DISABLED=1 npx next build
touch out/.nojekyll
# a Vercel não deve tentar publicar a branch gh-pages (site estático do GitHub Pages)
echo '{ "git": { "deploymentEnabled": false } }' > out/vercel.json
echo "✔ versão local gerada em ./out"
