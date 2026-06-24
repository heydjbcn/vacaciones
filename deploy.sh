#!/usr/bin/env bash
# Despliega vacaciones: sube a GitHub (backup/historial) y a Dokku (producción).
# Uso: ./deploy.sh            (asume que ya has hecho commit)
#      ./deploy.sh "mensaje"  (hace commit -a con ese mensaje y luego despliega)
set -euo pipefail
cd "$(dirname "$0")"

if [ "${1:-}" != "" ]; then
  git add -A
  git -c user.email="j.maurim@gmail.com" -c user.name="Mauri" commit -m "$1"
fi

echo "==> Push a GitHub (github/main) ..."
git push github main

echo "==> Deploy a Dokku (dokku/main) ..."
git push dokku main

echo "==> Verificando ..."
curl -s -o /dev/null -w "vacaciones.jmauri.com -> HTTP %{http_code}\n" https://vacaciones.jmauri.com/
echo "OK."
