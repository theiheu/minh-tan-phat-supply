import { createClient } from "@supabase/supabase-js";
import fs from "fs";

if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const admin = createClient(URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

export const canonicalUnits = [
  // Đơn vị đếm (count)
  { code: "cai", name: "Cái", symbol: "cái", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "bo", name: "Bộ", symbol: "bộ", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "chiec", name: "Chiếc", symbol: "chiếc", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "con", name: "Con", symbol: "con", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "tam", name: "Tấm", symbol: "tấm", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "cay", name: "Cây", symbol: "cây", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "soi", name: "Sợi", symbol: "sợi", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "ong", name: "Ống", symbol: "ống", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "vien", name: "Viên", symbol: "viên", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "bong", name: "Bóng", symbol: "bóng", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "vong", name: "Vòng", symbol: "vòng", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "doi", name: "Đôi", symbol: "đôi", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "cap", name: "Cặp", symbol: "cặp", dimension: "count", factor_to_reference: 1, decimal_scale: 0, is_active: true },

  // Đơn vị đóng gói (package)
  { code: "hop", name: "Hộp", symbol: "hộp", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "thung", name: "Thùng", symbol: "thùng", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "bao", name: "Bao", symbol: "bao", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "can", name: "Can", symbol: "can", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "chai", name: "Chai", symbol: "chai", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "cuon", name: "Cuộn", symbol: "cuộn", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "bich", name: "Bịch", symbol: "bịch", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "goi", name: "Gói", symbol: "gói", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "binh", name: "Bình", symbol: "bình", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "phuy", name: "Phuy", symbol: "phuy", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "xo", name: "Xô", symbol: "xô", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "tuyp", name: "Tuýp", symbol: "tuýp", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "vi", name: "Vỉ", symbol: "vỉ", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "kien", name: "Kiện", symbol: "kiện", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },
  { code: "pallet", name: "Pallet", symbol: "pallet", dimension: "package", factor_to_reference: 1, decimal_scale: 0, is_active: true },

  // Khối lượng (mass)
  { code: "kg", name: "Kg", symbol: "kg", dimension: "mass", factor_to_reference: 1, decimal_scale: 3, is_active: true },
  { code: "gam", name: "Gam", symbol: "g", dimension: "mass", factor_to_reference: 0.001, decimal_scale: 2, is_active: true },
  { code: "tan", name: "Tấn", symbol: "tấn", dimension: "mass", factor_to_reference: 1000, decimal_scale: 3, is_active: true },
  { code: "ta", name: "Tạ", symbol: "tạ", dimension: "mass", factor_to_reference: 100, decimal_scale: 3, is_active: true },
  { code: "yen", name: "Yến", symbol: "yến", dimension: "mass", factor_to_reference: 10, decimal_scale: 3, is_active: true },

  // Chiều dài (length)
  { code: "met", name: "Mét", symbol: "m", dimension: "length", factor_to_reference: 1, decimal_scale: 3, is_active: true },
  { code: "cm", name: "Centimét", symbol: "cm", dimension: "length", factor_to_reference: 0.01, decimal_scale: 2, is_active: true },
  { code: "mm", name: "Milimét", symbol: "mm", dimension: "length", factor_to_reference: 0.001, decimal_scale: 2, is_active: true },

  // Thể tích (volume)
  { code: "lit", name: "Lít", symbol: "l", dimension: "volume", factor_to_reference: 1, decimal_scale: 3, is_active: true },
  { code: "ml", name: "Mililít", symbol: "ml", dimension: "volume", factor_to_reference: 0.001, decimal_scale: 1, is_active: true },
  { code: "m3", name: "Mét khối", symbol: "m³", dimension: "volume", factor_to_reference: 1000, decimal_scale: 3, is_active: true },

  // Diện tích (area)
  { code: "m2", name: "Mét vuông", symbol: "m²", dimension: "area", factor_to_reference: 1, decimal_scale: 2, is_active: true }
];

async function seed() {
  for (const u of canonicalUnits) {
    const { error } = await admin.from("units").upsert(u, { onConflict: "code" });
    if (error) console.error("Failed to seed unit", u.code, error);
  }
  const { data: all } = await admin.from("units").select("id, code, name, symbol").order("name");
  console.log("Seeded units successfully! Total count:", all?.length);
  console.log("Sample units:", all?.slice(0, 10));
}

seed();
