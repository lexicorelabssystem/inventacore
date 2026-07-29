#!/bin/sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/opt/inventacore-labsystem}
ENV_FILE=${ENV_FILE:-"$PROJECT_DIR/.env.production"}
COMPOSE_FILE=${COMPOSE_FILE:-"$PROJECT_DIR/compose.yaml"}
BACKUP_FILE=${1:-}

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Uso: $0 /ruta/al/respaldo.dump" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[restore] falta el archivo de entorno del servidor" >&2
  exit 1
fi

if [ -f "$BACKUP_FILE.sha256" ]; then
  (
    cd "$(dirname "$BACKUP_FILE")"
    sha256sum -c "$(basename "$BACKUP_FILE").sha256"
  )
fi

compose() {
  docker compose \
    --project-directory "$PROJECT_DIR" \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    --profile restore "$@"
}

compose up -d restore-db

attempt=0
until compose exec -T restore-db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "[restore] PostgreSQL temporal no alcanzo estado disponible" >&2
    exit 1
  fi
  sleep 2
done

compose exec -T restore-db \
  sh -c 'pg_restore --no-owner --no-privileges --exit-on-error --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  < "$BACKUP_FILE"

table_count=$(compose exec -T restore-db sh -c \
  'psql --tuples-only --no-align --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = '\''public'\'';"')
migration_count=$(compose exec -T restore-db sh -c \
  'psql --tuples-only --no-align --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --command="SELECT count(*) FROM public._prisma_migrations;"')

echo "[restore] restauracion temporal verificada"
echo "[restore] tablas publicas: $table_count"
echo "[restore] migraciones registradas: $migration_count"
echo "[restore] la instancia temporal se conserva; no eliminar sin autorizacion"
