# 📖 HƯỚNG DẪN 15: TRỢ LÝ AI COPILOT & TRA CỨU TRI THỨC TRANG TRẠI

Tài liệu hướng dẫn nhân viên và quản lý cách sử dụng Trợ lý AI Copilot (Omniroute RAG) để tra cứu quy trình vận hành, bảng tiêu chuẩn kỹ thuật thiết bị và quản trị tài liệu tri thức nội bộ.

---

## 1. TỔNG QUAN VỀ TRỢ LÝ AI COPILOT

* **Vị trí hiển thị:** Nút bong bóng chat màu tím nổi ở góc dưới bên phải màn hình (có thể kéo thả di chuyển vị trí) trên mọi trang web.
* **Khả năng chính:**
  1. **Tra cứu quy trình chuẩn (SOP):** Hướng dẫn xử lý sự cố trại gà (cháy quạt thông gió, tắc dàn lạnh, cách ly dịch bệnh...).
  2. **Tra cứu thông số kỹ thuật:** Quy cách motor, áp suất đường ống nước, tỷ lệ pha thuốc sát trùng, dầu nhớt phù hợp cho từng loại xe tải/máy xúc.
  3. **Tra cứu nhanh tồn kho & nhiên liệu:** Hỏi đáp về tồn kho khả dụng hiện tại, định mức tiêu hao của xe.
  4. **Gợi ý câu hỏi nhanh (Quick Prompts):** Bấm chọn ngay các câu hỏi phổ biến mà không cần gõ phím.

---

## 2. HƯỚNG DẪN SỬ DỤNG CHO NHÂN VIÊN HIỆN TRƯỜNG

1. **Mở khung chat:** Bấm vào biểu tượng AI Copilot ở góc dưới màn hình.
2. **Đặt câu hỏi:**
   * *Ví dụ 1:* "Quạt trại 1.5kW bị kẹt cánh bốc khói thì xử lý thế nào?"
   * *Ví dụ 2:* "Xe ben Đồng Vàng chạy 100km tiêu thụ bao nhiêu lít dầu là bình thường?"
   * *Ví dụ 3:* "Thuốc sát trùng Benkocid pha theo tỷ lệ nào khi phun trại trống?"
3. **Đọc câu trả lời:** AI Copilot sẽ tự động trích xuất đúng tài liệu nội bộ của trại, trả lời ngắn gọn, có trích dẫn nguồn văn bản và gợi ý các bước xử lý kế tiếp.
4. **Tạo phiên trò chuyện mới:** Bấm nút **"+ Cuộc trò chuyện mới"** ở thanh tiêu đề drawer khi muốn chuyển sang chủ đề khác.

---

## 3. QUẢN TRỊ TRI THỨC CHO QUẢN TRỊ VIÊN & KỸ THUẬT (`/admin/ai-copilot`)

* **Thẩm quyền:** `superuser`, `owner`, `accountant`.
* **Đường dẫn:** Menu **Quản trị** ➜ **AI Copilot** (`/admin/ai-copilot`).

### A. Nạp tài liệu tri thức mới (Knowledge Documents):
1. Nhấn nút **"Tải lên tài liệu"**.
2. Điền **Tiêu đề tài liệu**, chọn **Danh mục** (Quy trình kỹ thuật, Sổ tay vận hành, Thông số máy...).
3. Dán nội dung văn bản (hoặc upload file Markdown/Text).
4. Nhấn **"Lưu & Đồng bộ Vector"**.
5. Hệ thống sẽ tự động phân tách văn bản thành các chunks nhỏ (200-500 từ) và tính toán vector embedding 1536 chiều lưu vào cơ sở dữ liệu `ai_knowledge_chunks`.

### B. Quản lý Câu hỏi gợi ý (Quick Prompts):
* Cho phép thêm, sửa, ẩn/hiện hoặc đổi thứ tự các câu hỏi gợi ý nhanh xuất hiện trên khung chat của nhân viên.

### C. Giám sát sử dụng & Giới hạn tốc độ (Rate Limiting):
* Hệ thống tự động giới hạn tần suất gọi API AI theo người dùng nhằm tối ưu chi phí và chống spam.
