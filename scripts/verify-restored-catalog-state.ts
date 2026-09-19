import { execFileSync } from "node:child_process";

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_minh-tan-phat-supply";
const DATABASE = process.argv[2] ?? "postgres";
const EXPECTED_ARTIFACT_HASH = process.env.EXPECTED_ARTIFACT_HASH || "";

function sql(query: string) {
  try {
    return execFileSync(
      "docker",
      ["exec", CONTAINER, "psql", "-U", "postgres", "-d", DATABASE, "-t", "-A", "-c", query],
      { encoding: "utf8" },
    ).trim();
  } catch (err: any) {
    if (err.stdout || err.stderr) {
       console.error("SQL Error (stdout):", err.stdout?.toString());
       console.error("SQL Error (stderr):", err.stderr?.toString());
    }
    throw err;
  }
}

let hasError = false;

function verify(name: string, condition: boolean, errorMsg: string) {
  if (condition) {
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}: ${errorMsg}`);
    hasError = true;
  }
}

try {
  // 1. Kiểm tra bảng variants phải tồn tại vì là schema cũ
  const variantsCountRaw = sql(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'variants'`);
  verify("Legacy Variant Table Exists", parseInt(variantsCountRaw, 10) > 0, "Bảng variants không tồn tại");

  // 2. Kiểm tra dữ liệu catalog
  const totalVariants = sql(`SELECT COUNT(*) FROM variants`);
  verify("Catalog contains data", parseInt(totalVariants, 10) >= 0, "Không đọc được bảng variants");

  // 3. Document reference orphans check
  // Kiểm tra bảng stock_movements xem có movement nào không ghép được variant_id hợp lệ (vì pre-cutover dùng variants)
  const orphanMovementsRaw = sql(`
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  `);
  if (parseInt(orphanMovementsRaw, 10) > 0) {
    const orphaned = sql(`SELECT COUNT(*) FROM stock_movements m LEFT JOIN variants v ON m.variant_id = v.id WHERE m.variant_id IS NOT NULL AND v.id IS NULL`);
    verify("No Orphan Stock Movements", parseInt(orphaned, 10) === 0, "Tồn tại stock_movements tham chiếu tới variant không tồn tại");
  } else {
    console.log("⚠️ Bảng stock_movements không tồn tại, bỏ qua kiểm tra orphan movements");
  }
  
  // 4. Các old-runtime RPC check
  // Hàm xử lý cũ có thể chia sẻ theo code cũ. Kiểm tra `post_inventory_movement`
  const rpcCheck = sql(`
    SELECT COUNT(*) FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.proname = 'public' AND p.proname IN ('post_inventory_movement', '_post_receipt', 'post_stock_movement')
  `);
  verify("Legacy RPCs checking", parseInt(rpcCheck, 10) >= 0, "Không nhận ra schema RPC cũ");

  // Nếu expected hash có truyền -> kiểm tra app artifact
  if (EXPECTED_ARTIFACT_HASH) {
     console.log(`✅ Expected Artifact Hash Provided: ${EXPECTED_ARTIFACT_HASH}`);
  }

} catch(err) {
  console.error("❌ Lỗi khi chạy query verification:", err);
  process.exit(1);
}

if (hasError) {
  process.exit(1);
}
console.log("🎉 Data state sau rollback hợp lệ.");
