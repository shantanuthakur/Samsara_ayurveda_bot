#!/bin/bash
export QDRANT_CONFIG_DIR="$(pwd)"
./qdrant --config-path ./qdrant_config.yaml > qdrant.log 2>&1 &
echo "Qdrant started in background. Logs in qdrant.log"
