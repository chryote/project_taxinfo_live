#!/usr/bin/env bash
set -e

SCENARIO=${1:-smoke}
BASE_URL=${BASE_URL:-http://localhost:3000}

echo "============================================================"
echo "SAMSAT PKB Benchmark Orchestrator"
echo "Scenario: $SCENARIO | Target: $BASE_URL"
echo "============================================================"

if command -v k6 &> /dev/null; then
    echo "Found native k6 binary. Executing scenario..."
    SCRIPT="./k6/scenarios/${SCENARIO}-test.js"
    if [ ! -f "$SCRIPT" ]; then
        SCRIPT="./k6/scenarios/${SCENARIO}.js"
    fi
    k6 run -e BASE_URL="$BASE_URL" "$SCRIPT"
    exit $?
fi

if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo "Running k6 via official grafana/k6 Docker container..."
    SCRIPT="/scripts/${SCENARIO}-test.js"
    docker run --rm -i -v "$(pwd)/k6/scenarios:/scripts:ro" -e BASE_URL="$BASE_URL" grafana/k6:latest run "$SCRIPT"
    exit $?
fi

echo "k6 binary / Docker not detected in active shell session."
echo "Running high-performance benchmark suite (Node.js engine)..."
node ./k6/native-bench.mjs "$SCENARIO"
exit $?
