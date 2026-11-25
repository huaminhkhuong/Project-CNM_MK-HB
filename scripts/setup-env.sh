#!/bin/bash
# Wrapper chạy script sinh .env trên Linux / VPS
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node "$DIR/scripts/setup-env.js" "$@"

