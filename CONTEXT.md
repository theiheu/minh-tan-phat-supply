# CONTEXT — Domain Glossary & Architectural Constraints

Tài liệu này định nghĩa các thuật ngữ domain chính thức của hệ thống **Minh Tân Phát Supply**.
Mọi agent, developer và tài liệu trong repo phải tuân thủ nghiêm ngặt các định nghĩa này.

---

## 1. Thuật ngữ Catalog & Tồn Kho (SKU & Inventory Master)

| Thuật ngữ | Định nghĩa Chuẩn | Ghi chú Triển khai |
|---|---|---|
| **Product / Vật tư** | Danh tính chung của một nhóm hàng hóa. Không trực tiếp giữ tồn, không có giá, không giao dịch trực tiếp. | Bảng `products`. Ví dụ: "Motor quạt hút", "Thuốc sát trùng Benkocid". |
| **SKU** | Đơn vị lưu kho nhỏ nhất có thể nhập, xuất, chuyển, kiểm kê và giữ tồn. Mỗi SKU có Đơn vị cơ sở duy nhất. | Bảng `skus`. Ví dụ: `SKU-MOTOR-1.5KW-380V-SKF`. |
| **Thuộc tính (Attribute)** | Đặc trưng kỹ thuật của SKU có kiểu dữ liệu rõ ràng (Number, Text, Option). Dùng làm trục phân cấp hoặc thông số kỹ thuật. | Bảng: `attribute_definitions`, `sku_attribute_values`. |
| **Đơn vị cơ sở (Base UOM)** | Đơn vị đo lường nhỏ nhất dùng để ghi nhận tồn kho của SKU trong Stock Ledger. | Ví dụ: `Cái`, `Kg`, `Lít`, `Mét`. |
| **Đơn vị giao dịch (Transaction UOM)** | Đơn vị đóng gói/nhập/xuất của SKU có hệ số quy đổi (snapshot) về Đơn vị cơ sở. | Bảng: `sku_transaction_units`. Ví dụ: Thùng (6 hộp), Can (5 lít). |
| **Bộ ảo (Virtual Kit)** | SKU có định mức BOM nhưng không giữ tồn độc lập. Khi xuất kho, hệ thống tự động trừ tồn các SKU thành phần. | `kit_type = 'virtual'`. |
| **Bộ ráp sẵn (Assembled Kit)** | SKU có định mức BOM và giữ tồn độc lập. Tồn kho tăng qua nghiệp vụ lắp ráp (Assembly) và trừ linh kiện con. | `kit_type = 'assembled'`. |
| **BOM (Bill of Materials)** | Định mức cấu tạo linh kiện có phiên bản của một SKU cha từ các SKU con. | Bảng: `bom_versions`, `bom_items`. |
| **Stock Ledger / Sổ cái kho** | Nguồn sự thật append-only ghi nhận mọi biến động tồn theo SKU + Vị trí kho + Đơn vị cơ sở. Không bao giờ xóa bản ghi cũ, đảo bút toán bằng reversal movement. | Bảng: `stock_movements`. |
| **Stock Balance** | Số dư tồn kho tức thời của SKU tại từng vị trí kho, tính từ Stock Ledger. | Bảng: `stock_balances`, view `location_stock`. |

---

## 2. Thuật ngữ Nghiệp vụ Vận hành Trại Gà (Operational Domain)

| Thuật ngữ | Định nghĩa & Ý nghĩa Vận hành |
|---|---|
| **Phiếu yêu cầu (Requisition)** | Công nhân/Trưởng trại lập phiếu xin cấp vật tư trên điện thoại. Quy trình duyệt 2 cấp: Kỹ thuật duyệt cấp 1 ➔ Quản kho xuất cấp cấp 2. |
| **Phiếu nhập kho (Receipt / GRN)** | Nhập vật tư từ Nhà cung cấp, gắn số hóa đơn VAT, upload ảnh chứng từ và tự động cấp phát (Auto-fulfill) cho phiếu đã duyệt. |
| **Phiếu xuất kho (Issue / PXK)** | Xuất vật tư trực tiếp gắn theo Dãy trại (`sub_zones`) để hạch toán chi phí, hoặc xuất bán thương mại cho khách hàng. |
| **Phiếu báo hỏng (Defect Note)** | Ghi nhận sự cố hư hỏng tại trại, bắt buộc chụp >= 1 ảnh hiện trường và mô tả lỗi để phục vụ đối soát. |
| **Đổi 1-1 cấp tốc (Quick Exchange)** | Nghiệp vụ khẩn cấp cứu trại: Xuất ngay thiết bị mới và thu thiết bị cháy về Kho Hỏng trong 30 giây (1 transaction). |
| **Phiếu sửa chữa (Repair Order)** | Gom thiết bị hỏng gửi xưởng cơ điện ngoài quấn lại motor/bơm; nghiệm thu đạt chuẩn chuyển về Kho Tổng tái sử dụng. |
| **Phiếu thanh lý (Liquidation)** | Bán phế liệu ve chai hoặc tiêu hủy thiết bị không thể phục hồi, Chủ trại duyệt thu tiền về quỹ. |
| **Mượn - Trả dụng cụ (Tool Borrowing)** | Quản lý tủ đồ nghề dùng chung (máy hàn, máy khoan, thang nhôm). Có hẹn ngày trả và gửi email cảnh báo quá hạn. |
| **Khu vực & Dãy trại (Zones & Sub-zones)** | Cây không gian 2 cấp: Khu lớn (`zones`, VD: Khu A, Khu B) và Dãy trại con (`sub_zones`, VD: Trại A1, A2). |
| **Kho dầu & Xe cơ giới (Fuel & Fleet)** | Trạm bồn dầu Diesel nội bộ: Quét tem QR xe, ghi nhận ODO/giờ máy, tự động tính L/100km hoặc L/h, cảnh báo bất thường. |
| **Kiểm kê kho (Stocktake)** | Đếm tồn kho thực tế định kỳ bằng điện thoại, chụp ảnh bằng chứng, đối soát thừa/thiếu và duyệt cân bằng tồn kho. |
| **Chuyển kho (Transfer)** | Điều chuyển vật tư giữa Kho Tổng, Kho Cơ Điện, Kho Hỏng, Trạm Bồn Dầu với lịch sử minh bạch. |

---

## 3. Thuật ngữ Kỹ thuật & Ràng buộc Kiến trúc (Architecture Constraints)

| Thuật ngữ | Định nghĩa Kỹ thuật & Ràng buộc |
|---|---|
| **Server Actions** | Hàm `async` đánh dấu `'use server'` trong Next.js App Router, chạy hoàn toàn trên server, gọi trực tiếp từ Client Component với Zod validation. |
| **Security Definer RPC** | Hàm PostgreSQL chạy với đặc quyền quản trị viên DB để thực hiện các transaction phức tạp, kiểm tra số dư và ghi sổ cái kho an toàn. |
| **Row Level Security (RLS)** | Chính sách bảo mật cấp hàng trong PostgreSQL 17 đảm bảo từng vai trò chỉ đọc/ghi đúng dữ liệu được phép. |
| **Immutable Identity** | Nguyên tắc bất biến định danh: Sau khi tạo tài khoản, `name` và `username` bị khóa vĩnh viễn bởi DB Trigger `trg_profiles_prevent_identity_change`. |
| **Hybrid Archive & Force Purge** | Nhân sự có lịch sử chứng từ ➔ chuyển sang trạng thái Lưu trữ (`is_active = false`); Tài khoản trống ➔ Xóa vĩnh viễn (Hard Delete); Superuser có quyền Purge toàn diện (`admin_purge_user_data`). |
| **Append-Only Ledger** | Bảng `stock_movements` không được phép `UPDATE` hay `DELETE` (DB Trigger chặn). Mọi thao tác hoàn tác phải tạo movement đối ứng (reversal). |
| **Auto-Fulfill Outcome** | Sau khi nhập kho, hệ thống tự động quét và hoàn tất các phiếu yêu cầu đã duyệt (`approved`) theo thứ tự FIFO và lưu vết bền vững. |
| **Vector PDF Engine** | Render PDF trực tiếp phía client/server bằng `@react-pdf/renderer` với font tiếng Việt nhúng sẵn (`Roboto-Regular`, `Roboto-Bold`), chuẩn hóa nhận diện thương hiệu và mã QR tra cứu. |
| **AI Copilot RAG** | Hệ thống trợ lý AI tích hợp qua Vercel AI SDK, trích xuất dữ liệu kho và tài liệu SOP vận hành trại với cơ chế rate limit và chunking chuẩn hóa. |

---

## 4. Bảng Thuật ngữ Đối chiếu (Terminology Mapping)

| ❌ Thuật ngữ Sai / Cũ | ✅ Thuật ngữ Chuẩn Hiện Tại | Lý do & Ý nghĩa |
|---|---|---|
| `variant` (trong code mới) | `sku` | Kiến trúc mới sử dụng bảng `skus` làm hạt nhân tồn kho. |
| "Đơn vị đóng gói là biến thể riêng" | "Transaction UOM của SKU" | Đơn vị đóng gói chỉ là hệ số quy đổi về Base UOM của cùng 1 SKU. |
| "Bộ vật tư là một loại Product" | "SKU có định mức BOM (Kit)" | Product chỉ là định danh chung, SKU mới có cấu trúc BOM linh kiện. |
| JSON attributes tự do | Typed Attribute Definitions | Dùng bảng `attribute_definitions` để chuẩn hóa lọc và tìm kiếm. |
| Xóa dòng stock movement | Tạo Reversal Movement đối ứng | Sổ cái kho phải đảm bảo nguyên tắc kế toán bất biến (Append-Only). |
| Chọn kho tự do khi báo hỏng | Kho nguồn mặc định là Kho Tổng | Đồ hỏng chỉ chuyển vào Kho Hỏng khi được phê duyệt đổi hoặc sửa. |

---

## 5. Deployment Manifest Reference

Trạng thái cutover, artifact hash và cấu hình môi trường được kiểm soát tập trung qua file manifest tại `docs/operations/current-deployment-status.yaml`.
Mọi tài liệu và báo cáo triển khai phải đồng bộ dữ liệu với manifest này và được thẩm định bằng `scripts/validate-manifest.js`.
