"use server";

import { revalidatePath } from "next/cache";
import { requireSuperuser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractTextFromFile, chunkText, generateContentHash } from "@/lib/ai/knowledge/chunker";

type DbAny = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        single: () => Promise<{ data: { id: string } | null; error: Error | null }>;
        order: (col: string, opts?: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: Error | null }>;
      } & Promise<{ data: unknown[] | null; error: Error | null }>;
    };
    insert: (data: unknown) => {
      select: (col: string) => {
        single: () => Promise<{ data: { id: string } | null; error: Error | null }>;
      };
    } & Promise<{ error: Error | null }>;
    delete: () => { eq: (col: string, val: string) => Promise<{ error: Error | null }> };
  };
};

/**
 * 1. Upload file tài liệu (PDF, Word, TXT, MD) và nạp tự động vào Knowledge Base
 */
export async function uploadDocumentAction(formData: FormData) {
  try {
    await requireSuperuser();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const category = (formData.get("category") as string | null)?.trim() || "sop";

    if (!file || file.size === 0) {
      return { success: false, error: "Vui lòng chọn file tài liệu (.pdf, .docx, .txt, .md)." };
    }

    if (!title) {
      return { success: false, error: "Vui lòng nhập tên tài liệu." };
    }

    // 1. Đọc nội dung file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const textContent = await extractTextFromFile(buffer, file.name, file.type);

    if (!textContent || textContent.trim().length < 30) {
      return { success: false, error: "Tài liệu không chứa đủ nội dung văn bản để trích xuất." };
    }

    // 2. Băm SHA-256 và cắt Chunks
    const contentHash = generateContentHash(textContent);
    const chunks = chunkText(textContent, 700, 100);

    if (chunks.length === 0) {
      return { success: false, error: "Không thể phân đoạn văn bản." };
    }

    const supabase = createAdminClient();
    const db = supabase as unknown as DbAny;

    const sourceKey = `upload:${Date.now()}:${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    // 3. Tạo Document
    const { data: doc, error: docError } = await db.from("ai_knowledge_documents").insert({
      source_key: sourceKey,
      content_hash: contentHash,
      title: title,
      category: category,
      metadata: {
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_at: new Date().toISOString(),
      },
    }).select("id").single();

    if (docError || !doc) {
      return { success: false, error: docError?.message || "Lỗi lưu tài liệu vào CSDL." };
    }

    // 4. Lưu Chunks
    const chunkRows = chunks.map((chunk, index) => ({
      document_id: doc.id,
      chunk_index: index,
      content: chunk,
      metadata: {
        title,
        category,
        index,
      },
    }));

    const { error: chunkError } = await db.from("ai_knowledge_chunks").insert(chunkRows);

    if (chunkError) {
      return { success: false, error: chunkError.message };
    }

    revalidatePath("/admin/ai-copilot");
    return {
      success: true,
      message: `Đã nạp thành công tài liệu "${title}" (${chunks.length} phân đoạn tri thức).`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Đã xảy ra lỗi khi nạp tài liệu.",
    };
  }
}

/**
 * 2. Nhập trực tiếp văn bản thủ công (Manual Text / SOP)
 */
export async function createManualDocumentAction(data: {
  title: string;
  category: string;
  content: string;
}) {
  try {
    await requireSuperuser();
    const title = data.title.trim();
    const category = data.category.trim() || "sop";
    const content = data.content.trim();

    if (!title || !content) {
      return { success: false, error: "Vui lòng nhập đầy đủ tiêu đề và nội dung tài liệu." };
    }

    if (content.length < 30) {
      return { success: false, error: "Nội dung tài liệu quá ngắn (tối thiểu 30 ký tự)." };
    }

    const contentHash = generateContentHash(content);
    const chunks = chunkText(content, 700, 100);

    const supabase = createAdminClient();
    const db = supabase as unknown as DbAny;

    const sourceKey = `manual:${Date.now()}:${title.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30)}`;

    const { data: doc, error: docError } = await db.from("ai_knowledge_documents").insert({
      source_key: sourceKey,
      content_hash: contentHash,
      title: title,
      category: category,
      metadata: {
        created_manually: true,
        created_at: new Date().toISOString(),
      },
    }).select("id").single();

    if (docError || !doc) {
      return { success: false, error: docError?.message || "Lỗi lưu tài liệu vào CSDL." };
    }

    const chunkRows = chunks.map((chunk, index) => ({
      document_id: doc.id,
      chunk_index: index,
      content: chunk,
      metadata: {
        title,
        category,
        index,
      },
    }));

    const { error: chunkError } = await db.from("ai_knowledge_chunks").insert(chunkRows);

    if (chunkError) {
      return { success: false, error: chunkError.message };
    }

    revalidatePath("/admin/ai-copilot");
    return {
      success: true,
      message: `Đã tạo tài liệu "${title}" thành công (${chunks.length} phân đoạn tri thức).`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Đã xảy ra lỗi khi tạo tài liệu.",
    };
  }
}

/**
 * 3. Trích xuất văn bản từ file upload (dùng cho AI Ingestion Chat)
 */
export async function extractTextFromUploadAction(formData: FormData): Promise<{
  success: boolean;
  text?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}> {
  try {
    await requireSuperuser();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return { success: false, error: "Vui lòng chọn file hợp lệ (.txt, .md, .docx, .pdf)." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extracted = await extractTextFromFile(buffer, file.name, file.type);

    if (!extracted || extracted.trim().length < 10) {
      return { success: false, error: "Không thể trích xuất văn bản từ file này hoặc nội dung quá ngắn." };
    }

    return {
      success: true,
      text: extracted.trim(),
      fileName: file.name,
      fileSize: file.size,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Lỗi khi đọc file tài liệu.",
    };
  }
}

/**
 * 4. Nạp tài liệu đã được AI chuẩn hóa trực tiếp vào CSDL Tri thức
 */
export async function ingestStandardizedDocAction(data: {
  title: string;
  category: string;
  content: string;
  summary?: string;
  keywords?: string[];
}): Promise<{
  success: boolean;
  docId?: string;
  chunkCount?: number;
  message?: string;
  error?: string;
}> {
  try {
    await requireSuperuser();
    const title = data.title.trim();
    const category = data.category.trim() || "sop";
    const content = data.content.trim();
    const summary = data.summary?.trim() || "";
    const keywords = Array.isArray(data.keywords) ? data.keywords : [];

    if (!title || !content) {
      return { success: false, error: "Vui lòng nhập đầy đủ tiêu đề và nội dung tài liệu." };
    }

    if (content.length < 30) {
      return { success: false, error: "Nội dung tài liệu quá ngắn (tối thiểu 30 ký tự)." };
    }

    const contentHash = generateContentHash(content);
    const chunks = chunkText(content, 700, 100);

    if (chunks.length === 0) {
      return { success: false, error: "Không thể phân đoạn văn bản." };
    }

    const supabase = createAdminClient();
    const db = supabase as unknown as DbAny;

    const slug = title.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
    const sourceKey = `ai_standardized:${Date.now()}:${slug}`;

    const { data: doc, error: docError } = await db.from("ai_knowledge_documents").insert({
      source_key: sourceKey,
      content_hash: contentHash,
      title: title,
      category: category,
      metadata: {
        standardized_by_ai: true,
        summary,
        keywords,
        created_at: new Date().toISOString(),
      },
    }).select("id").single();

    if (docError || !doc) {
      return { success: false, error: docError?.message || "Lỗi lưu tài liệu vào CSDL." };
    }

    const chunkRows = chunks.map((chunk, index) => ({
      document_id: doc.id,
      chunk_index: index,
      content: chunk,
      metadata: {
        title,
        category,
        index,
        summary,
        keywords,
      },
    }));

    const { error: chunkError } = await db.from("ai_knowledge_chunks").insert(chunkRows);

    if (chunkError) {
      return { success: false, error: chunkError.message };
    }

    revalidatePath("/admin/ai-copilot");
    return {
      success: true,
      docId: doc.id,
      chunkCount: chunks.length,
      message: `Đã nạp thành công tài liệu "${title}" vào CSDL Tri thức AI (${chunks.length} phân đoạn).`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Đã xảy ra lỗi khi nạp tài liệu.",
    };
  }
}

/**
 * 5. Xóa tài liệu khỏi Knowledge Base
 */
export async function deleteDocumentAction(documentId: string) {
  try {
    await requireSuperuser();
    const supabase = createAdminClient();
    const db = supabase as unknown as DbAny;

    const { error } = await db.from("ai_knowledge_documents").delete().eq("id", documentId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/ai-copilot");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Không thể xóa tài liệu.",
    };
  }
}
