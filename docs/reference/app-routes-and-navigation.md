# 🌐 BẢN ĐỒ ĐỊNH TUYẾN APP ROUTER & ĐIỀU HƯỚNG (APP ROUTES & NAVIGATION MAP)

> Tài liệu tham chiếu chi tiết toàn bộ các đường dẫn URL (Routes), nhóm định tuyến (Route Groups), các trang giao diện và phân quyền truy cập của hệ thống **Minh Tân Phát Supply**.

---

## 1. CẤU TRÚC NHÓM ĐỊNH TUYẾN (NEXT.JS ROUTE GROUPS)

Hệ thống phân tách thành 3 nhóm định tuyến chính:
1. **`(auth)`**: Các trang công khai phục vụ xác thực người dùng (Đăng nhập Username/Mật khẩu).
2. **`(app)`**: Toàn bộ không gian làm việc chính sau khi đăng nhập (Được bảo vệ bởi Middleware xác thực phiên GoTrue).
3. **`api/`**: Các Endpoint xử lý xuất file Excel, sinh PDF vector, giải mã QR, thông báo email định kỳ và AI Copilot.

---

## 2. DANH MỤC CÁC TRANG LÀM VIỆC CHÍNH (`src/app/(app)/*`)

| Đường dẫn (URL) | Tên màn hình | Mục đích & Nghiệp vụ chính | Vai trò có quyền truy cập |
|---|---|---|---|
| `/dashboard` | **Tổng quan theo Vai trò** | Dashboard KPI may đo theo 7 vai trò, tác vụ nhanh, thông báo, nhật ký kiểm toán. | Tất cả vai trò đã đăng nhập |
| `/products` | **Tra cứu Danh mục SKU** | Xem danh mục sản phẩm, biến thể, giá bán, vị trí kệ và tồn kho khả dụng. | Tất cả vai trò |
| `/requisitions` | **Phiếu Yêu Cầu** | Danh sách phiếu xin cấp vật tư, theo dõi tiến trình 5 cột mốc, upload hóa đơn mua gấp. | `superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester` |
| `/requisitions/new` | **Tạo Phiếu Yêu Cầu** | Giao diện giỏ hàng chọn vật tư xin cấp, chọn Dãy trại đích. | `superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester` |
| `/requisitions/[id]` | **Chi tiết Phiếu Yêu Cầu**| Xem chi tiết, chuyển trạng thái đặt hàng, xuất hàng, upload hóa đơn và nút Xác nhận đã nhận. | Tùy vai trò & quyền hạn |
| `/receipts` | **Phiếu Nhập Kho** | Quản lý danh sách các phiếu nhập hàng từ Nhà Cung Cấp. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/receipts/new` | **Tạo Phiếu Nhập** | Nhập hàng, chọn NCC, nhập đơn giá mua, upload ảnh hóa đơn đỏ VAT và auto-fulfill. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/receipts/[id]` | **Chi tiết Phiếu Nhập** | Xem chi tiết hàng nhập, xem ảnh hóa đơn phóng to lightbox, in phiếu nhập A4/A5. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/issues` | **Phiếu Xuất Kho** | Quản lý phiếu xuất kho nội bộ theo dãy trại và xuất bán thương mại. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/issues/new` | **Tạo Phiếu Xuất** | Lập phiếu xuất kho trực tiếp, gắn đích đến (Khu/Dãy trại hoặc Khách hàng).| `superuser`, `owner`, `accountant`, `warehouse` |
| `/issues/[id]` | **Chi tiết Phiếu Xuất** | Xem chi tiết hàng xuất, in phiếu xuất kho A4/A5 chuẩn nhận diện. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/defects` | **Báo Hỏng & Đổi 1-1** | Danh sách thiết bị hỏng tại trại và lịch sử các lượt đổi 1-1 cấp tốc. | `superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester` |
| `/defects/new` | **Đổi 1-1 Cấp Tốc** | Thao tác đổi motor/bơm cháy trong 30 giây: xuất hàng mới, nạp hàng hỏng. | `superuser`, `owner`, `accountant`, `warehouse`, `technician` |
| `/defects/exchange/[id]`| **Chi tiết Đổi 1-1** | Xem chi tiết giao dịch đổi thiết bị và lịch sử xử lý. | `superuser`, `owner`, `accountant`, `warehouse`, `technician` |
| `/repairs` | **Sửa Chữa Cơ Điện** | Quản lý các đợt gửi motor đi quấn, nghiệm thu hoàn thành đưa lại kho tổng. | `superuser`, `owner`, `accountant`, `warehouse`, `technician` |
| `/liquidations` | **Thanh Lý Phế Liệu** | Quản lý phiếu bán phế liệu ve chai, Chủ trại duyệt thu tiền về quỹ. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/tools` | **Dụng Cụ Đồ Nghề** | Quản lý tủ đồ nghề dùng chung, cho mượn, thu hồi, cảnh báo quá hạn mượn. | `superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester` |
| `/fuel` | **Trạm Bồn Xăng Dầu** | Lịch sử nhập bồn dầu, danh sách bơm dầu cho xe và cấp dầu toàn khu. | `superuser`, `owner`, `accountant`, `warehouse`, `driver` |
| `/fuel/scan` | **Quét QR Đổ Dầu** | Giao diện Camera quét mã QR dán trên cabin xe, xem lịch sử lần đổ trước và bơm dầu 5 giây. | `superuser`, `owner`, `accountant`, `warehouse`, `driver` |
| `/transfers` | **Chuyển Kho Nội Bộ** | Điều chuyển hàng hóa giữa các vị trí kho vật lý (Kho Tổng -> Kho Cơ Điện).| `superuser`, `owner`, `accountant`, `warehouse` |
| `/stocktake` | **Kiểm Kê Kho** | Mở phiên kiểm kê, quét QR đếm thực tế, tính thừa thiếu và duyệt cân bằng. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/assemblies` | **Lắp Ráp Bộ Vật Tư** | Lắp ráp bộ theo định mức BOM hoặc tháo rã thu hồi linh kiện. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/reports` | **Trung Tâm Báo Cáo** | Hub báo cáo: Tổng quan Ban giám đốc, Sổ cái XNT, Thẻ kho Stock Card, Chi phí Dãy trại, Hiệu suất Xe, Views Metabase BI. | `superuser`, `owner`, `accountant`, `warehouse`, `technician` (khu mình) |
| `/qr/[entity]/[id]` | **Trang Tra Cứu QR** | Màn hình hiển thị thông tin nhanh khi dùng điện thoại quét mã QR ngoài thực địa.| Tất cả vai trò |

---

## 3. DANH MỤC CÁC TRANG QUẢN TRỊ HỆ THỐNG (`/admin/*`)

| Đường dẫn (URL) | Tên màn hình | Mục đích | Thẩm quyền tối thiểu |
|---|---|---|---|
| `/admin` | **Trung Tâm Quản Trị** | Menu điều hướng quản trị danh mục tổng thể. | `superuser`, `owner`, `accountant` |
| `/admin/users` | **Quản Lý Người Dùng** | Tạo tài khoản, đổi mật khẩu, phân 7 vai trò, Khóa/Lưu trữ và Kích hoạt lại. | `superuser`, `owner`, `accountant` |
| `/admin/zones` | **Khu Vực & Dãy Trại**| Quản lý danh mục 2 cấp: Khu vực lớn (`zones`) và Dãy trại (`sub_zones`). | `superuser`, `owner`, `accountant`, `warehouse` |
| `/admin/products`| **Quản Trị SKU & Vật Tư**| Khai báo 5 bước, cấu hình thuộc tính, đơn vị quy đổi và định mức BOM. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/admin/categories`| **Ngành Hàng** | Quản lý danh mục phân loại vật tư và icon hiển thị. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/admin/suppliers` | **Nhà Cung Cấp** | Quản lý danh bạ công ty, cửa hàng cung cấp thiết bị và xăng dầu. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/admin/customers` | **Khách Hàng** | Quản lý danh bạ đại lý, thương lái thu mua phân gà, phế liệu. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/admin/locations` | **Vị Trí Kho** | Quản lý danh sách các kho vật lý trong trang trại. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/admin/vehicles` | **Dàn Xe Cơ Giới** | Danh mục xe, quản lý ảnh giấy tờ xe (đăng kiểm, bảo hiểm, cà vẹt) và in tem QR. | `superuser`, `owner`, `accountant`, `warehouse` |
| `/admin/documents` | **Quản Trị Chứng Từ** | Kiểm tra cây phụ thuộc và can thiệp xóa cứng/hoàn tác chứng từ cấp cao. | `superuser`, `owner` |
| `/admin/ai-copilot` | **Quản Trị AI Copilot** | Tải lên tài liệu SOP vận hành trại, quản lý vector chunks và embeddings. | `superuser`, `owner`, `accountant` |

---

## 4. CÁC API ENDPOINTS CHUYÊN DỤNG (`src/app/api/*`)

| Endpoint | Phương thức | Chức năng |
|---|---|---|
| `/api/reports/export` | `GET` / `POST` | Xuất báo cáo tài chính, báo cáo XNT hoặc báo cáo tiêu hao xe ra file Excel (`.xlsx`). |
| `/api/export` | `GET` | Xuất sổ cái tồn kho và danh mục vật tư ra file bảng tính. |
| `/api/upload` | `POST` | Xử lý nén ảnh hóa đơn, ảnh hư hỏng và tải lên Supabase Storage bucket. |
| `/api/qr/[entity]/[id]` | `GET` | Trả về thông tin QR của đối tượng hoặc sinh mã QR dạng ảnh vector. |
| `/api/vehicles/[id]/qr` | `GET` | Sinh tem decal QR vector chất lượng cao gắn xe cơ giới. |
| `/api/fuel/dispenses/[id]/pdf` | `GET` | Render và tải về file PDF phiếu xuất cấp nhiên liệu. |
| `/api/fuel/receipts/[id]/pdf` | `GET` | Render và tải về file PDF phiếu nhập dầu bồn. |
| `/api/requisitions/[id]/pdf` | `GET` | In phiếu yêu cầu vật tư A4/A5 có mã QR tra cứu. |
| `/api/receipts/[id]/pdf` | `GET` | In phiếu nhập kho NCC A4/A5 chuẩn nhận diện. |
| `/api/issues/[id]/pdf` | `GET` | In phiếu xuất kho cấp phát A4/A5. |
| `/api/defects/[id]/pdf` | `GET` | In phiếu báo hỏng và biên bản kiểm tra thiết bị. |
| `/api/repairs/[id]/pdf` | `GET` | In đơn giao việc sửa chữa cơ điện gửi xưởng ngoài. |
| `/api/liquidations/[id]/pdf` | `GET` | In biên bản thanh lý phế liệu ve chai. |
| `/api/tools/[id]/pdf` | `GET` | In phiếu mượn đồ nghề tủ dụng cụ. |
| `/api/stocktake/[id]/pdf` | `GET` | In biên bản kiểm kê kho định kỳ. |
| `/api/internal/tool-reminders` | `POST` | Endpoint nội bộ kích hoạt gửi email nhắc nợ đồ nghề quá hạn. |
| `/api/ai/chat` | `POST` | API xử lý luồng trò chuyện Streaming của AI Copilot với context RAG. |
| `/api/ai/quick-prompts` | `GET` | Trả về danh sách câu hỏi nhanh gợi ý cho người dùng. |
| `/api/ai/admin/documents` | `GET` / `POST` / `DELETE` | Quản lý nạp/xóa tài liệu tri thức vào vector store. |
| `/api/ai/admin/conversations/[id]/messages` | `GET` | Tra cứu lịch sử tin nhắn của phiên chat AI. |
