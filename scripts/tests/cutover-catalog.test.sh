#!/usr/bin/env bash
# scripts/tests/cutover-catalog.test.sh

set -euo pipefail

SCRIPT_PATH="$(cd "$(dirname "$0")/../.." && pwd)/scripts/cutover-catalog.sh"
echo "Testing $SCRIPT_PATH"

export MTP_CUTOVER_APPROVED=false
if bash "$SCRIPT_PATH" 2>/dev/null; then
  echo "❌ TEST FAILED: Should fail if MTP_CUTOVER_APPROVED != true"
  exit 1
else
  echo "✅ TEST PASSED: Fails when MTP_CUTOVER_APPROVED is false."
fi

export MTP_CUTOVER_APPROVED=true
unset MTP_EXPECTED_APP_COMMIT
if bash "$SCRIPT_PATH" 2>/dev/null; then
  echo "❌ TEST FAILED: Should fail if MTP_EXPECTED_APP_COMMIT is missing"
  exit 1
else
  echo "✅ TEST PASSED: Fails when MTP_EXPECTED_APP_COMMIT is missing."
fi

export MTP_EXPECTED_APP_COMMIT="test-commit-xyz"
unset MTP_EXPECTED_SCHEMA_VERSION
if bash "$SCRIPT_PATH" 2>/dev/null; then
  echo "❌ TEST FAILED: Should fail if MTP_EXPECTED_SCHEMA_VERSION is missing"
  exit 1
else
  echo "✅ TEST PASSED: Fails when MTP_EXPECTED_SCHEMA_VERSION is missing."
fi

export MTP_EXPECTED_SCHEMA_VERSION="0088_test"
unset MTP_MAINTENANCE_WINDOW
if bash "$SCRIPT_PATH" 2>/dev/null; then
  echo "❌ TEST FAILED: Should fail if MTP_MAINTENANCE_WINDOW is missing"
  exit 1
else
  echo "✅ TEST PASSED: Fails when MTP_MAINTENANCE_WINDOW is missing."
fi

export MTP_MAINTENANCE_WINDOW="Saturday 2AM"

# We won't test full success here because it requires a dirty-tree check bypass and running docker containers.
# Just ensuring failure conditions are handled robustly.
echo "🎉 All local fail-closed assertions passed."
