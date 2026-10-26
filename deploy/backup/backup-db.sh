#!/bin/sh
# Dumps the database every day at BACKUP_HOUR_UTC (and once right at start), then deletes dumps older than BACKUP_KEEP_DAYS.
# A dump is written to a temporary name and renamed only when pg_dump succeeded, so a half-written file is never taken for a backup.
set -eu

KEEP="${BACKUP_KEEP_DAYS:-14}"
HOUR="${BACKUP_HOUR_UTC:-21}"
DIR=/backups/db
mkdir -p "$DIR"

dump() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  tmp="$DIR/.investmap-$stamp.dump.part"
  if pg_dump --format=custom --no-owner --file="$tmp"; then
    mv "$tmp" "$DIR/investmap-$stamp.dump"
    echo "backup ok: investmap-$stamp.dump ($(du -h "$DIR/investmap-$stamp.dump" | cut -f1))"
    find "$DIR" -name 'investmap-*.dump' -mtime "+$KEEP" -print -delete
  else
    rm -f "$tmp"
    echo "backup FAILED at $stamp" >&2
    return 1
  fi
}

dump || true
while true; do
  now="$(date -u +%s)"
  today="$(date -u +%Y-%m-%d)"
  next="$(date -u -d "$today $(printf '%02d' "$HOUR"):00:00" +%s)"
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  dump || true
done
