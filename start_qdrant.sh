#!/bin/bash
# Start Qdrant with the local database
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "Starting Qdrant on port 6333 with local DB at $SCRIPT_DIR/qdrant_local_db..."
export QDRANT__STORAGE__STORAGE_PATH="$SCRIPT_DIR/qdrant_local_db"
export QDRANT__SERVICE__HOST="0.0.0.0"

./qdrant
