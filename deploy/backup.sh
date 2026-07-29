#!/bin/sh
set -eu

umask 077

PROJECT_DIR=${PROJECT_DIR:-/opt/inventacore-labsystem}
ENV_FILE=${ENV_FILE:-"$PROJECT_DIR/.env.production"}
BACKUP_DIR=${BACKUP_DIR:-"$PROJECT_DIR/backups"}
COMPOSE_FILE=${COMPOSE_FILE:-"$PROJECT_DIR/compose.yaml"}

if [ ! -f "$ENV_FILE" ]; then
  echo "[backup] falta el archivo de entorno del servidor" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_name="inventacore_labsystem_${timestamp}.dump"
backup_path="$BACKUP_DIR/$backup_name"

docker compose \
  --project-directory "$PROJECT_DIR" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T db \
  sh -c 'pg_dump --format=custom --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  > "$backup_path"

chmod 600 "$backup_path"
(
  cd "$BACKUP_DIR"
  sha256sum "$backup_name" > "$backup_name.sha256"
)
chmod 600 "$backup_path.sha256"

echo "[backup] respaldo y checksum creados fuera del volumen PostgreSQL"
echo "[backup] archivo: $backup_name"
