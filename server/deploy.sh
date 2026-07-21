#!/usr/bin/env bash
# MediKit backend deploy — pull latest, rebuild the server image, restart the stack.
# Mirrors the sample_project SSH-deploy flow. Runs on the host from the checkout at
# $REPO_DIR (default ~/opt/medikit). Postgres data persists in the medikit-pgdata volume.
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/opt/medikit}"
BRANCH="${BRANCH:-master}"

cd "$REPO_DIR"

echo "▶ Fetching latest ($BRANCH)…"
git fetch --prune origin
git reset --hard "origin/$BRANCH"

cd server

if [ ! -f .env ]; then
  echo "✖ server/.env missing — copy .env.example and set JWT_SECRET + PGPASSWORD." >&2
  exit 1
fi

echo "▶ Rebuilding + restarting containers…"
docker compose up -d --build

echo "▶ Pruning dangling images…"
docker image prune -f >/dev/null 2>&1 || true

echo "▶ Waiting for health…"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4010/health >/dev/null 2>&1; then
    echo "✓ Deploy OK — server healthy."
    exit 0
  fi
  sleep 2
done

echo "✖ Server did not become healthy in time. Recent logs:" >&2
docker compose logs --tail 40 medikit-server >&2
exit 1
