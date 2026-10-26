#!/bin/sh
# Mirrors the uploaded files to /backups/media every day. "sync" without --delete only adds and updates,
# so a file deleted on the site by mistake stays in the mirror and can be recovered.
set -eu

HOUR="${BACKUP_HOUR_UTC:-21}"
DIR=/backups/media
mkdir -p "$DIR"

mirror() {
  if ! aws --endpoint-url "$S3_ENDPOINT" s3api head-bucket --bucket "$S3_BUCKET" >/dev/null 2>&1; then
    echo "no files uploaded yet, nothing to back up"
    return 0
  fi
  if aws --endpoint-url "$S3_ENDPOINT" s3 sync "s3://$S3_BUCKET" "$DIR" --only-show-errors; then
    echo "media backup ok: $(du -sh "$DIR" | cut -f1)"
  else
    echo "media backup FAILED" >&2
    return 1
  fi
}

# The bucket appears with the first upload; until then there is nothing to copy.
mirror || true
while true; do
  now="$(date -u +%s)"
  today="$(date -u +%Y-%m-%d)"
  next="$(date -u -d "$today $(printf '%02d' "$HOUR"):30:00" +%s)"
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  mirror || true
done
