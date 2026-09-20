/**
 * CLI Script: Đồng bộ tài liệu SOP & Cẩm nang trang trại vào Dify Knowledge Dataset.
 * Chạy:
 *   pnpm tsx scripts/dify-sync-knowledge.ts
 * Hoặc:
 *   pnpm sync:dify
 */

import fs from "fs";
import path from "path";
import { DifyClient } from "../src/lib/ai/providers/dify";

// Tự động đọc biến môi trường từ .env.local
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const difyBaseUrl = process.env.DIFY_API_BASE_URL || "http://127.0.0.1:5001/v1";
const difyDatasetApiKey = process.env.DIFY_DATASET_API_KEY || process.env.DIFY_API_KEY || "";
const difyDatasetId = process.env.DIFY_DATASET_ID || "";

if (!difyDatasetApiKey || !difyDatasetId) {
  console.log("ℹ️ [DIFY SYNC INFO]: Chưa tìm thấy DIFY_DATASET_ID hoặc DIFY_API_KEY trong .env.local.");
  console.log("   Vui lòng tạo Dataset trên giao diện Dify Web UI (Datasets -> Create Dataset)");
  console.log("   và thêm vào .env.local:");
  console.log("   DIFY_DATASET_ID=your_dataset_uuid");
  console.log("   DIFY_DATASET_API_KEY=dataset-xxxxxxxx");
  console.log("   DIFY_API_BASE_URL=" + difyBaseUrl);
  process.exit(0);
}

const client = new DifyClient(difyBaseUrl, difyDatasetApiKey);

interface DocTarget {
  dir?: string;
  file?: string;
  namePrefix: string;
}

const TARGETS: DocTarget[] = [
  { file: "SO_TAY_VAN_HANH_TRAI.md", namePrefix: "Sổ Tay Vận Hành Trại" },
  { dir: "docs/user-guide", namePrefix: "Quy Trình Nghiệp Vụ" },
  { dir: "docs/architecture", namePrefix: "Kiến Trúc Hệ Thống" },
];

async function runDifySync() {
  console.log("🚀 Bắt đầu tiến trình Đồng bộ Tri thức sang Dify Knowledge Dataset...");
  console.log("📡 Dify Server:", difyBaseUrl);
  console.log("📂 Target Dataset ID:", difyDatasetId);

  let successCount = 0;
  let failCount = 0;

  for (const target of TARGETS) {
    if (target.file) {
      const filePath = path.resolve(process.cwd(), target.file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        const docName = target.namePrefix;
        console.log(`📄 Đang nạp tài liệu: ${docName} (${filePath})...`);
        try {
          await client.createDocumentByText({
            datasetId: difyDatasetId,
            name: docName,
            text: content,
            datasetApiKey: difyDatasetApiKey,
          });
          console.log(`✅ Nạp thành công: ${docName}`);
          successCount++;
        } catch (err: any) {
          console.error(`❌ Lỗi nạp ${docName}:`, err.message);
          failCount++;
        }
      }
    } else if (target.dir) {
      const dirPath = path.resolve(process.cwd(), target.dir);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const content = fs.readFileSync(filePath, "utf8");
          const docName = `${target.namePrefix} - ${file.replace(/\.md$/, "")}`;
          console.log(`📄 Đang nạp tài liệu: ${docName}...`);
          try {
            await client.createDocumentByText({
              datasetId: difyDatasetId,
              name: docName,
              text: content,
              datasetApiKey: difyDatasetApiKey,
            });
            console.log(`✅ Nạp thành công: ${docName}`);
            successCount++;
          } catch (err: any) {
            console.error(`❌ Lỗi nạp ${docName}:`, err.message);
            failCount++;
          }
        }
      }
    }
  }

  console.log("--------------------------------------------------");
  console.log(`🎉 Hoàn tất đồng bộ Dify: ${successCount} thành công, ${failCount} thất bại.`);
}

runDifySync();
