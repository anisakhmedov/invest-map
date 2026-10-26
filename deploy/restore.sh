#!/bin/sh
# Restores the database (and optionally the files) from the backups volume.
#   ./restore.sh                      lists available dumps
#   ./restore.sh db <dump-file-name>  replaces the database with that dump (asks first)
#   ./restore.sh media                copies the mirrored files back into storage
# Run from the deploy folder on the server.
set -eu

COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml}"

case "${1:-list}" in
  list)
    $COMPOSE run --rm --no-deps --entrypoint sh backup-db -c 'ls -1t /backups/db/investmap-*.dump 2>/dev/null || echo "no dumps yet"'
    ;;
  db)
    file="${2:?give the dump file name, see ./restore.sh list}"
    printf 'This REPLACES the current database with %s. Type "yes" to continue: ' "$file"
    read -r answer
    [ "$answer" = "yes" ] || { echo "cancelled"; exit 1; }
    $COMPOSE stop web
    $COMPOSE run --rm --no-deps --entrypoint sh backup-db -c "
      set -e
      pg_restore --clean --if-exists --no-owner --single-transaction --dbname=\"\$PGDATABASE\" \"/backups/db/$(basename "$file")\"
    "
    $COMPOSE up -d web
    echo "database restored from $file"
    ;;
  media)
    $COMPOSE run --rm --no-deps --entrypoint sh backup-media -c 'aws --endpoint-url "$S3_ENDPOINT" s3 mb "s3://$S3_BUCKET" 2>/dev/null || true; aws --endpoint-url "$S3_ENDPOINT" s3 sync /backups/media "s3://$S3_BUCKET" --only-show-errors'
    echo "files restored"
    ;;
  *)
    echo "usage: $0 [list | db <file> | media]" >&2
    exit 2
    ;;
esac
