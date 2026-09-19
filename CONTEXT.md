# CONTEXT — Domain Glossary & Architectural Constraints

Tài liệu này định nghĩa các thuật ngữ domain chính thức của hệ thống **Minh Tân Phát Supply**.  
Mọi agent, developer và tài liệu trong repo phải dùng đúng thuật ngữ này.

---

## 1. Thuật ngữ Catalog & Tồn kho

| Thuật ngữ | Định nghĩa | Ghi chú thêm |
|---|---|---|
| **Product / Vật tư** | Danh tính chung của một nhóm hàng. Không trực tiếp giữ tồn, không có giá, không giao dịch. | Ví dụ: "Motor quạt IP55", "Thuốc sát trùng Vikon" |
| **SKU** | Dòng hàng nhỏ nhất có thể nhập, xuất, chuyển, kiểm kê và giữ tồn. Mỗi SKU có Đơn vị cơ sở duy nhất. | Code DB: bảng `skus`. |
| **Thuộc tính (Attribute)** | Đặc trưng kỹ thuật của SKU có kiểu dữ liệu rõ ràng. Có thể là trục phân biệt SKU hoặc thông số mô tả. | Ví dụ: công suất (kW), điện áp (V), kích thước (mm). Bảng: `attribute_definitions`. |
| **Đơn vị cơ sở (Base UOM)** | Đơn vị duy nhất dùng để ghi tồn của một SKU trong Stock Ledger. | Ví dụ: Cái, Kg, Lít |
| **Đơn vị giao dịch (Transaction UOM)** | Đơn vị nhập/xuất riêng của SKU có hệ số quy đổi (snapshot) về Đơn vị cơ sở. | Ví dụ: Thùng (24 cái), Bao (25kg). Bảng: `sku_transaction_units`. |
| **Bộ ảo (Virtual Kit)** | SKU có BOM nhưng không giữ tồn riêng. Khi xuất → tự động trừ tồn các SKU thành phần. | `kit_type = 'virtual'` |
| **Bộ ráp sẵn (Assembled Kit)** | SKU có BOM và giữ tồn riêng. Tồn tăng qua nghiệp vụ lắp ráp (Assembly operation). | `kit_type = 'assembled'` |
| **BOM (Bill of Materials)** | Cấu tạo có phiên bản của một SKU từ các SKU thành phần. Có version để bảo toàn lịch sử. | Bảng: `sku_bom_versions`, `sku_bom_lines` |
| **Stock Ledger / Sổ cái kho** | Nguồn sự thật append-only ghi nhận mọi biến động tồn theo SKU + vị trí + đơn vị cơ sở. | Hủy giao dịch tạo movement đảo, không xóa movement gốc. Bảng: `stock_movements`. |
| **Stock Balance** | Tồn hiện tại của SKU tại một vị trí kho, tính từ Stock Ledger. | Bảng: `stock_balances`. |
| **Document Snapshot** | Bản chụp tại thời điểm chứng từ: hệ số quy đổi UOM, giá, BOM version. Bảo toàn ý nghĩa lịch sử khi dữ liệu master thay đổi. | Bảng: `inventory_document_snapshots`. |

---

## 2. Thuật ngữ Nghiệp vụ

| Thuật ngữ | Định nghĩa |
|---|---|
| **Phiếu yêu cầu (Requisition)** | Công nhân/Kỹ thuật xin cấp vật tư. Qua duyệt 2 cấp: Kỹ thuật → Kho. |
| **Phiếu nhập kho (Receipt)** | Nhập vật tư từ nhà cung cấp. Có thể gắn hóa đơn VAT và ảnh chứng từ. |
| **Phiếu xuất kho / Cấp phát (Issue)** | Xuất vật tư nội bộ gắn theo Zone/Sub-zone chuồng, hoặc xuất bán thương mại. |
| **Báo hỏng (Defect Note)** | Ghi nhận thiết bị hỏng. Khởi đầu cho luồng Đổi 1-1 hoặc Sửa chữa. |
| **Đổi 1-1 cấp tốc (Quick Exchange)** | Xuất ngay hàng mới + nhận hàng hỏng vào kho hỏng trong 1 transaction (≤30 giây). |
| **Phiếu sửa chữa (Repair Order)** | Gửi thiết bị hỏng đi sửa bên ngoài, theo dõi tiến độ, nghiệm thu và đưa về kho. |
| **Thanh lý (Liquidation)** | Bán phế liệu hoặc tiêu hủy thiết bị không thể sửa chữa. |
| **Kiểm kê (Stocktake)** | Đếm tồn thực tế định kỳ, đối chiếu với tồn hệ thống, cân bằng chênh lệch. |
| **Chuyển kho (Transfer)** | Điều chuyển vật tư từ kho này sang kho khác nội bộ. |
| **Mượn-Trả (Tool Borrowing)** | Theo dõi mượn/trả dụng cụ dùng chung (máy hàn, thang nhôm). Có cảnh báo quá hạn. |
| **Zone / Sub-zone** | Khu vực / Dãy chuồng. Sub-zone gắn với từng phiếu xuất để phân tích chi phí. |
| **Kho dầu (Fuel)** | Trạm bồn xăng dầu: mỗi xe có QR riêng, ghi lại lượng dầu + ODO/giờ máy. |

---

## 3. Thuật ngữ Kỹ thuật

| Thuật ngữ | Định nghĩa |
|---|---|
| **Server Action** | Hàm `async` đánh dấu `'use server'` trong Next.js, chạy trên server, gọi trực tiếp từ Client Component. Thay thế API endpoints thủ công. |
| **RPC (Remote Procedure Call)** | Hàm PostgreSQL `SECURITY DEFINER` được gọi qua Supabase API. Xử lý logic nghiệp vụ phức tạp, đảm bảo ACID transaction. |
| **RLS (Row Level Security)** | Chính sách bảo mật cấp hàng trong PostgreSQL. Mỗi user chỉ đọc/ghi được các rows phù hợp với vai trò. |
| **Posting Kernel** | Lớp trung tâm append-only xử lý mọi biến động kho. Mỗi movement có: nguồn chứng từ, snapshot, idempotency key và khả năng reversal. |
| **Immutable Identity** | Sau khi tạo tài khoản, `full_name` và `username` bị khóa vĩnh viễn bởi DB Trigger `trg_profiles_prevent_identity_change`. |
| **Hybrid Archive** | Tài khoản có lịch sử chứng từ → set `is_active=false` (lưu trữ). Tài khoản trống → xóa vĩnh viễn (Hard Delete). |
| **Auto-fulfill** | Sau khi nhập kho, hệ thống tự động cấp phát cho các phiếu yêu cầu **đã được duyệt** (status: `approved`). FIFO. |

---

## 4. Thuật ngữ cần tránh

| ❌ Sai | ✅ Đúng | Lý do |
|---|---|---|
| `variant` (cho code mới) | `sku` | Kiến trúc đích dùng SKU |
| "biến thể" (trong context tồn kho) | "SKU" | Tránh nhầm lẫn với variants cũ |
| "đơn vị đóng gói là biến thể" | "Transaction UOM" | Đơn vị đóng gói không phải SKU |
| "bộ vật tư là một loại Product" | "SKU có BOM" | Product không giao dịch, SKU mới có BOM |
| JSON attributes tự do | Typed Attribute Definitions | JSON không chuẩn hóa, không filter được |
| Xóa stock movement | Tạo movement đảo (reversal) | Stock Ledger phải append-only |

