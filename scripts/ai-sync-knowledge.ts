import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Đọc tự động .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseServiceKey) {
  console.error("❌ Thiếu SUPABASE_SERVICE_ROLE_KEY trong môi trường hoặc .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function chunkMarkdown(content: string, maxChunkLength = 1000): string[] {
  // Tách văn bản theo các đầu mục heading Markdown (## hoặc ###)
  const sections = content.split(/(?=\n#{1,3}\s+)/g);
  const chunks: string[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxChunkLength) {
      chunks.push(trimmed);
    } else {
      // Nếu 1 section quá dài, chia theo đoạn văn bản kép (paragraph)
      const paragraphs = trimmed.split(/\n\n+/g);
      let currentChunk = "";

      for (const p of paragraphs) {
        if ((currentChunk + "\n\n" + p).length > maxChunkLength && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = p;
        } else {
          currentChunk = currentChunk ? currentChunk + "\n\n" + p : p;
        }
      }
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    }
  }

  return chunks.length > 0 ? chunks : [content];
}

async function syncUserGuides() {
  const docsDir = path.resolve(process.cwd(), "docs/user-guide");
  if (!fs.existsSync(docsDir)) {
    console.log("⚠️ Không tìm thấy thư mục docs/user-guide");
    return;
  }

  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".md"));
  console.log(`📂 Tìm thấy ${files.length} tài liệu hướng dẫn trong docs/user-guide/...`);

  let syncedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const sourceKey = `user-guide:${file}`;
    const hash = computeHash(content);

    // Lấy dòng tiêu đề đầu tiên từ file markdown
    const firstLine = content.split("\n").find((l) => l.startsWith("# ")) || file;
    const title = firstLine.replace(/^#+\s*/, "").trim();

    // 1. Kiểm tra hash trong database
    const { data: existingDoc } = await supabase
      .from("ai_knowledge_documents")
      .select("id, content_hash")
      .eq("source_key", sourceKey)
      .single();

    if (existingDoc && existingDoc.content_hash === hash) {
      console.log(`⏩ [BỎ QUA] ${file} (Không đổi - SHA256 khớp)`);
      skippedCount++;
      continue;
    }

    console.log(`🔄 [ĐỒNG BỘ] Đang đánh chỉ mục ${file} -> "${title}"...`);

    // 2. Cập nhật hoặc tạo mới document
    let docId = existingDoc?.id;
    if (existingDoc) {
      await supabase
        .from("ai_knowledge_documents")
        .update({
          title,
          content_hash: hash,
          category: "sop",
          updated_at: new Date().toISOString(),
        })
        .eq("id", docId);

      // Xóa chunks cũ để tạo lại
      await supabase.from("ai_knowledge_chunks").delete().eq("document_id", docId);
    } else {
      const { data: newDoc, error: insertError } = await supabase
        .from("ai_knowledge_documents")
        .insert({
          source_key: sourceKey,
          content_hash: hash,
          title,
          category: "sop",
          metadata: { fileName: file },
        })
        .select("id")
        .single();

      if (insertError || !newDoc) {
        console.error(`❌ Lỗi tạo document ${file}:`, insertError?.message);
        continue;
      }
      docId = newDoc.id;
    }

    // 3. Cắt chunks và lưu vào ai_knowledge_chunks
    const chunks = chunkMarkdown(content);
    const chunkRows = chunks.map((chunkText, idx) => ({
      document_id: docId,
      chunk_index: idx,
      content: chunkText,
      metadata: { file, sectionIndex: idx },
    }));

    const { error: chunkError } = await supabase.from("ai_knowledge_chunks").insert(chunkRows);
    if (chunkError) {
      console.error(`❌ Lỗi chèn chunks cho ${file}:`, chunkError.message);
    } else {
      syncedCount++;
      console.log(`   ✅ Đã lưu ${chunks.length} phân đoạn cho ${file}`);
    }
  }

  console.log(`\n🎉 Hoàn thành đồng bộ SOP: ${syncedCount} mới/cập nhật, ${skippedCount} bỏ qua (tiết kiệm token).`);
}

async function main() {
  console.log("🚀 Bắt đầu tiến trình Đồng bộ Tri thức AI (Incremental RAG Ingestion)...");
  await syncUserGuides();
}

main().catch(console.error);
