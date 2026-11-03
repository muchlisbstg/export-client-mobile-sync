#!/usr/bin/env bash
set -euo pipefail

# This host is a controlled schema-processing runner, not an application server.
# Do not fetch, copy, or import operational database rows from this bootstrap.
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends sqlite3 postgresql-client jq ca-certificates
apt-get clean
rm -rf /var/lib/apt/lists/*
