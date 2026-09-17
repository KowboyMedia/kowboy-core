#!/bin/sh
# Starts one role on App Platform: `sh scripts/start.sh web` or `worker` (.do/app.yaml).
#
# The managed cluster signs with its own CA, which the platform hands over as the value of
# DATABASE_CA_CERT. Node trusts an extra CA from a file, so the value goes through one; `pg` then
# verifies the certificate under the `sslmode=require` the platform's DATABASE_URL states.
set -e
if [ -n "$DATABASE_CA_CERT" ]; then
  printf '%s\n' "$DATABASE_CA_CERT" > /tmp/database-ca.crt
  export NODE_EXTRA_CA_CERTS=/tmp/database-ca.crt
fi
exec node dist/main.js "${1:-web}"
