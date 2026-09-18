#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo " [REHEARSAL] Full Material Catalog Replacement Cutover"
echo "========================================================"

EVIDENCE_FILE="docs/superpowers/evidence/$(date +%Y-%m-%d)-rehearsal-evidence.txt"
mkdir -p docs/superpowers/evidence

echo "1. Running Catalog Audit SQL..."
docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < scripts/catalog-audit.sql | tee "$EVIDENCE_FILE"

echo "2. Running Core Posting Kernel Checks..."
npx tsx scripts/verify-posting-kernel.ts | tee -a "$EVIDENCE_FILE"

echo "3. Running SKU Posting Checks..."
npx tsx scripts/verify-sku-posting.ts | tee -a "$EVIDENCE_FILE"

echo "4. Running Virtual Kit & Reservation Checks..."
npx tsx scripts/verify-virtual-kit-reservation.ts | tee -a "$EVIDENCE_FILE"

echo "5. Running Receipt Flow Checks..."
npx tsx scripts/verify-receipt-flow.ts | tee -a "$EVIDENCE_FILE"

echo "6. Running Requisition & Return Flow Checks..."
npx tsx scripts/verify-requisition-flow.ts | tee -a "$EVIDENCE_FILE"
npx tsx scripts/verify-return-history.ts | tee -a "$EVIDENCE_FILE"

echo "7. Running Issue, Transfer & Stocktake Flow Checks..."
npx tsx scripts/verify-issue-flow.ts | tee -a "$EVIDENCE_FILE"
npx tsx scripts/verify-transfers.ts | tee -a "$EVIDENCE_FILE"
npx tsx scripts/verify-stocktake.ts | tee -a "$EVIDENCE_FILE"

echo "8. Running Defect, Exchange & Repair Flow Checks..."
npx tsx scripts/verify-defect-exchange.ts | tee -a "$EVIDENCE_FILE"
npx tsx scripts/verify-exchange-repair.ts | tee -a "$EVIDENCE_FILE"

echo "9. Running Full Vitest Suite..."
npx vitest run | tee -a "$EVIDENCE_FILE"

echo "10. Running TypeScript Strict Typecheck..."
npm run typecheck | tee -a "$EVIDENCE_FILE"

echo "11. Running ESLint..."
npm run lint | tee -a "$EVIDENCE_FILE"

echo "12. Running Next.js Production Build..."
npm run build | tee -a "$EVIDENCE_FILE"

echo "========================================================"
echo " [SUCCESS] All 12 Rehearsal Verification Gates Passed!"
echo " Evidence saved to: $EVIDENCE_FILE"
echo "========================================================"
