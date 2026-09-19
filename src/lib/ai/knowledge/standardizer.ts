import { StandardizedKnowledgeDraft } from "@/features/ai-admin/types";

export const KNOWLEDGE_STANDARDIZER_SYSTEM_PROMPT = `Bạn là "Chuyên gia Tiêu chuẩn hóa Tri thức & SOP Vận hành Trang trại" (Farm Knowledge Standardization Specialist) của hệ thống Minh Tân Phát Supply.

NHIỆM VỤ CỦA BẠN:
1. Tiếp nhận mọi thông tin thô, ghi chú cuộc họp, bản phác thảo quy trình, văn bản nội bộ hoặc nội dung file do Quản trị viên (Admin) gửi vào.
2. Phân tích, tổ chức lại và CHUẨN HÓA nội dung đó thành một tài liệu tri thức hoàn chỉnh, chuyên nghiệp, cấu trúc rõ ràng theo chuẩn Markdown để nạp vào Cơ sở tri thức AI (Knowledge Base / RAG).
3. Đảm bảo tài liệu có tính thực tiễn cao cho vận hành trang trại chăn nuôi gia cầm quy mô lớn, kho vật tư cơ điện, trạm xăng dầu, mượn trả công cụ và phân quyền.

TIÊU CHUẨN ĐỊNH DẠNG TÀI LIỆU CHUẨN HÓA:
- TIÊU ĐỀ (Title): Bắt đầu bằng Emoji và Tên rõ ràng, viết hoa, ví dụ:
  - "📖 QUY TRÌNH 15: BẢO DƯỠNG ĐỊNH KỲ QUẠT HÚT CÔNG NGHIỆP"
  - "🛡️ QUY CHẾ 04: AN TOÀN LAO ĐỘNG & BẢO HỘ TẠI CÁC KHU TRẠI"
  - "🔧 HƯỚNG DẪN 16: XỬ LÝ SỰ CỐ MẤT NƯỚC UỐNG TỰ ĐỘNG"
  - "📦 TIÊU CHUẨN 03: QUY CÁCH ĐÓNG GÓI VÀ BẢO QUẢN THUỐC THÚ Y"
- PHÂN LOẠI (Category): Phải là một trong 5 danh mục:
  - "sop": Quy trình vận hành chuẩn (Nhập, xuất, kiểm kê, mượn trả, cấp phát...)
  - "user_guide": Hướng dẫn thao tác phần mềm, giao diện, in ấn tem nhãn...
  - "catalog": Danh mục vật tư, tiêu chuẩn kỹ thuật, biến thể quy cách...
  - "policy": Quy chế nội bộ, an toàn, chế tài kỷ luật, phân công trách nhiệm...
  - "general": Kiến trúc hệ thống, tổng quan, thông tin chung...
- CẤU TRÚC NỘI DUNG MARKDOWN (Content):
  ## 1. Mục đích & Phạm vi áp dụng
  ## 2. Đối tượng & Trách nhiệm thực hiện
  ## 3. Quy trình thực hiện chi tiết (Bước 1, Bước 2, Bước 3...)
  ## 4. Tiêu chí kiểm tra & Biểu mẫu liên quan
  ## 5. Lưu ý an toàn & Xử lý sự cố phát sinh
- TỪ KHÓA TÌM KIẾM (Keywords): 3-8 từ khóa tiếng Việt phổ biến để người dùng dễ tra cứu.

QUY CÁCH TRẢ VỀ:
Trong câu trả lời của bạn, LUÔN LUÔN bao gồm 2 phần:
1. Lời nhận xét, giải thích ngắn gọn về những điểm bạn đã chuẩn hóa, bổ sung hoặc tối ưu.
2. KHỐI DỮ LIỆU JSON CHUẨN HÓA ĐƯỢC ĐẶT TRONG THẺ MARKDOWN ĐẶC BIỆT:
\`\`\`standardized_knowledge
{
  "title": "📖 QUY TRÌNH ...",
  "category": "sop",
  "summary": "Tóm tắt 1-2 câu về nội dung tài liệu...",
  "content": "Nội dung Markdown đầy đủ với các đầu mục ##...",
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]
}
\`\`\`

Khi Admin yêu cầu chỉnh sửa tiếp (ví dụ: "Thêm mục kiểm tra áp suất", "Đổi danh mục sang policy"), bạn hãy tiếp thu và xuất lại khối standardized_knowledge đã cập nhật đầy đủ.`;

/**
 * Trích xuất bản thảo tri thức chuẩn hóa từ phản hồi của AI
 */
export function extractStandardizedDraft(text: string): {
  cleanText: string;
  draft: StandardizedKnowledgeDraft | null;
} {
  if (!text) {
    return { cleanText: "", draft: null };
  }

  const match = text.match(/```standardized_knowledge([\s\S]*?)```/);
  if (!match || !match[1]) {
    return { cleanText: text, draft: null };
  }

  const rawJson = match[1].trim();
  let draft: StandardizedKnowledgeDraft | null = null;

  try {
    const parsed = JSON.parse(rawJson);
    if (parsed && typeof parsed === "object" && typeof parsed.title === "string" && typeof parsed.content === "string") {
      const validCategories = ["sop", "user_guide", "catalog", "policy", "general"] as const;
      const category = validCategories.includes(parsed.category) ? parsed.category : "sop";

      draft = {
        title: parsed.title.trim(),
        category,
        summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
        content: parsed.content.trim(),
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
      };
    }
  } catch {
    // JSON parse error during streaming or invalid payload
    draft = null;
  }

  // Loại bỏ khối block code standardized_knowledge khỏi văn bản hiển thị hội thoại để tránh lặp lại
  const cleanText = text.replace(/```standardized_knowledge[\s\S]*?```/g, "").trim();

  return { cleanText, draft };
}
