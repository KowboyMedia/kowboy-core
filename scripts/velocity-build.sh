#!/bin/sh
# Cloudways Velocity's build command for Core (docs/decisions.md, 2026-10-24): a new version is
# built and started beside the running one, and takes over only once it has passed every step.
# Velocity runs this in the app's folder after its own `npm install`, with the app's settings in
# `.env` (they are not in the build's environment). Velocity puts a new version's files in place
# before it builds, so on its own a restart after a failed build would run the failed build; here
# a failed step leaves `.releases/current`, the version `scripts/start.sh` runs, as it was.
#
#   1. Copy this version's files to .releases/<time>-<commit>, install exactly the locked
#      dependencies there and build it.
#   2. The release preview over the app's database: every stored record still fits.
#   3. Start the new web process on a spare port beside the running version, and run the smoke
#      suite's start check against it: the database and its layout, the admin app, the sites' API.
#   4. Point .releases/current at it, the one step that switches, and keep the last three.
set -eu
app=$(pwd)
env_file="$app/.env"
[ -f "$env_file" ] || { echo "no .env in $app, where Velocity writes the app's settings" >&2; exit 1; }
releases="$app/.releases"
id="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo build)"
next="$releases/$id"
mkdir -p "$next"

# A failed step stops the check's web process and removes the half-made version.
check=""
finish() {
  status=$?
  if [ -n "$check" ]; then kill "$check" 2>/dev/null || true; fi
  if [ "$status" -ne 0 ]; then
    rm -rf "$next"
    echo "The build failed; the running version stays, and so does any restart of it." >&2
  fi
}
trap finish EXIT

echo "1. Building $id beside the running version."
tar -c --exclude=node_modules --exclude=./dist --exclude=./.releases --exclude=./.git \
  --exclude=./.env . | tar -x -C "$next"
cd "$next"
npm ci --no-audit --no-fund
npm run build

echo "2. The release preview over the app's database."
node --env-file="$env_file" dist/main.js preview

echo "3. Starting it beside the running version."
PORT=0 node --env-file="$env_file" dist/main.js web > start-check.log 2>&1 &
check=$!
port=""
for _ in $(seq 1 90); do
  port=$(sed -n 's/^web listening on \([0-9][0-9]*\)$/\1/p' start-check.log)
  if [ -n "$port" ] || ! kill -0 "$check" 2>/dev/null; then break; fi
  sleep 1
done
if [ -z "$port" ]; then
  cat start-check.log >&2
  echo "The new version did not start." >&2
  exit 1
fi
APP_URL="http://127.0.0.1:$port" node --env-file="$env_file" dist/main.js smoke start
kill "$check"
wait "$check" || true
check=""

echo "4. Switching to $id."
ln -sfn "$id" "$releases/current.next"
mv -T "$releases/current.next" "$releases/current"
cd "$releases"
for old in $(ls -1d 2*/ | sed 's:/$::' | sort -r | tail -n +4); do
  if [ "$old" != "$(readlink current)" ]; then rm -rf "$old"; fi
done
echo "Built, checked and switched to $id; the platform's restart starts it."
