#!/bin/bash
# Prepares a Claude Code on the web session so `npm run check` and `npm run test:wordpress` work
# without manual steps: Postgres for Core, MariaDB and a WordPress install for the WordPress client
# suite, and the npm dependencies. Idempotent; a local machine is left alone.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Postgres for the engine and the Lovable client tests (DATABASE_URL's default).
if command -v pg_lsclusters >/dev/null 2>&1; then
  service postgresql start >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do pg_isready -q -h 127.0.0.1 && break; sleep 1; done
  su postgres -c "psql -tAc \"select 1 from pg_roles where rolname = 'core'\"" | grep -q 1 \
    || su postgres -c "psql -qc \"create role core with login password 'core';\""
  su postgres -c "psql -tAc \"select 1 from pg_database where datname = 'core'\"" | grep -q 1 \
    || su postgres -c "psql -qc \"create database core owner core;\""
fi

# MariaDB for the WordPress client tests.
if ! command -v mariadbd >/dev/null 2>&1 && ! command -v mysqld >/dev/null 2>&1; then
  # The package lists are stale in a fresh session; without a refresh the install fails quietly.
  DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || true
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mariadb-server mariadb-client >/dev/null 2>&1 || true
fi
if command -v mariadbd >/dev/null 2>&1 || command -v mysqld >/dev/null 2>&1; then
  service mariadb start >/dev/null 2>&1 || service mysql start >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do mysqladmin -uroot ping >/dev/null 2>&1 && break; sleep 1; done
  mysql -uroot -e "create database if not exists core_client_test;
    create user if not exists 'core'@'127.0.0.1' identified by 'core';
    create user if not exists 'core'@'localhost' identified by 'core';
    grant all on core_client_test.* to 'core'@'127.0.0.1';
    grant all on core_client_test.* to 'core'@'localhost';
    flush privileges;" >/dev/null 2>&1 || true
fi

npm install --no-audit --no-fund >/dev/null 2>&1

# The WordPress install the client suite drives (clients/wordpress/test/setup.sh is idempotent).
if command -v php >/dev/null 2>&1 && mysql -h127.0.0.1 -ucore -pcore core_client_test -e "select 1" >/dev/null 2>&1; then
  bash clients/wordpress/test/setup.sh >/dev/null 2>&1 || echo "WordPress setup did not finish; npm run test:wordpress needs clients/wordpress/test/setup.sh"
fi

echo "session ready: Postgres, MariaDB, dependencies and WordPress prepared"
