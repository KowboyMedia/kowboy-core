#!/bin/sh
# Starts one role: `sh scripts/start.sh web`, `worker`, `preview` or `smoke` (.do/app.yaml), or
# `all`, which runs web and worker side by side in one app (Cloudways Velocity, docs/decisions.md).
#
# The managed cluster signs with its own CA, which the platform hands over as the value of
# DATABASE_CA_CERT. Node trusts an extra CA from a file, so the value goes through one; `pg` then
# verifies the certificate under the `sslmode=require` the platform's DATABASE_URL states.
set -e
if [ -n "$DATABASE_CA_CERT" ]; then
  printf '%s\n' "$DATABASE_CA_CERT" > /tmp/database-ca.crt
  export NODE_EXTRA_CA_CERTS=/tmp/database-ca.crt
fi
if [ "${1:-web}" != all ]; then
  exec node dist/main.js "${1:-web}"
fi

# Two processes, so a long catch-up in the worker never slows the web process down. When either
# ends, the other is stopped too and the app exits, so the platform restarts both together; a stop
# from the platform reaches both, and each shuts down the way it does on its own.
node dist/main.js web &
web=$!
node dist/main.js worker &
worker=$!
stop() { kill "$web" "$worker" 2>/dev/null || true; }
trap 'stop; wait; exit 0' TERM INT
while kill -0 "$web" 2>/dev/null && kill -0 "$worker" 2>/dev/null; do sleep 2; done
echo "a role ended on its own; stopping the other so the platform restarts both" >&2
stop
wait
exit 1
