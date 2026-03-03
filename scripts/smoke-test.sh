#!/bin/bash
# Smoke Test Script — MisterTuga Insights
# Runs automated checks that don't require a browser.
# Usage: bash scripts/smoke-test.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local result="$2"

  if [ "$result" -eq 0 ]; then
    echo -e "${GREEN}  PASS${NC}  $label"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}  FAIL${NC}  $label"
    FAIL=$((FAIL + 1))
  fi
}

warn() {
  local label="$1"
  echo -e "${YELLOW}  WARN${NC}  $label"
  WARN=$((WARN + 1))
}

echo ""
echo "========================================="
echo "  MisterTuga Insights — Smoke Test"
echo "========================================="
echo ""

# 1. TypeScript compilation
echo "--- TypeScript ---"
npx tsc --noEmit > /dev/null 2>&1
check "TypeScript compiles (0 errors)" $?

# 2. Production build
echo ""
echo "--- Build ---"
npm run build > /dev/null 2>&1
check "Production build succeeds" $?

# 3. Bundle size check
echo ""
echo "--- Bundle Sizes ---"
BUILD_OUTPUT=$(npm run build 2>&1)
ORDERS_SIZE=$(echo "$BUILD_OUTPUT" | grep "/master-shopify-orders" | awk '{print $2}' | tr -d ' ')
PROFIT_SIZE=$(echo "$BUILD_OUTPUT" | grep "/profit-stats" | awk '{print $2}' | tr -d ' ')
echo "  INFO  /master-shopify-orders: $ORDERS_SIZE"
echo "  INFO  /profit-stats: $PROFIT_SIZE"

# 4. Key files exist
echo ""
echo "--- Key Files ---"
FILES=(
  "src/app/(app)/master-shopify-orders/page.tsx"
  "src/app/(app)/profit-stats/page.tsx"
  "src/app/(app)/settings/page.tsx"
  "src/app/login/page.tsx"
  "src/components/auth-provider.tsx"
  "src/middleware.ts"
  "src/lib/supabase/client.ts"
  "src/lib/supabase/server.ts"
  "src/lib/supabase/auth.ts"
  "src/lib/rate-limit.ts"
  "src/lib/validate-webhook-url.ts"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    check "Exists: $f" 0
  else
    check "Exists: $f" 1
  fi
done

# 5. No .env committed
echo ""
echo "--- Security ---"
if git ls-files --error-unmatch .env > /dev/null 2>&1; then
  check ".env is NOT tracked by git" 1
else
  check ".env is NOT tracked by git" 0
fi

# 6. Summary
echo ""
echo "========================================="
echo -e "  Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${WARN} warnings${NC}"
echo "========================================="
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
