# 📚 TÀI LIỆU VẬN HÀNH & KIẾN TRÚC HỆ THỐNG — MINH TÂN PHÁT SUPPLY

Hệ thống Quản lý Kho & Vận hành Nội bộ Trang trại Chăn nuôi Gia cầm Công nghiệp Minh Tân Phát.
Ứng dụng xây dựng trên nền tảng **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase (PostgreSQL + GoTrue + RLS + RPC)** và hỗ trợ **PWA Offline-First**.

---

## 🧭 BẢN ĐỒ ĐIỀU HƯỚNG TÀI LIỆU (DOCUMENTATION INDEX)

Tài liệu được phân chia thành 3 trụ cột chính:
1. 🏗️ **Kiến trúc & Kỹ thuật (`docs/architecture/`):** Dành cho Kỹ sư CNTT và AI Agent hiểu sâu cơ chế hoạt động.
2. 📖 **Sổ tay Hướng dẫn Người dùng (`docs/user-guide/`):** Từng bước chi tiết cho từng nghiệp vụ thực tế.
3. ⚙️ **Vận hành & Bảo trì (`docs/operations/`):** Hướng dẫn Triển khai, Cấu hình môi trường và Xử lý sự cố.

---

### 1. 🏗️ KIẾN TRÚC & KỸ THUẬT (Dành cho Lập trình viên & AI Agent)

| Tài liệu | Nội dung chính |
|---|---|
| [**Kiến Trúc Hệ Thống**](./architecture/system-overview.md) | Tổng quan công nghệ, Luồng dữ liệu Server Action, Cache Metadata, PWA Offline Service Worker. |
| [**Ma Trận Phân Quyền 7 Vai Trò**](./architecture/rbac-and-roles.md) | Chi tiết ma trận 7 vai trò (`superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester`, `driver`), cơ chế bảo mật RLS, chính sách Bất biến định danh & Hybrid Archive. |
| [**Mô Hình Cơ Sở Dữ Liệu (ERD)**](./architecture/database-schema.md) | Toàn bộ lược đồ bảng, ràng buộc khóa ngoại, bảng liên kết cha-con, Triggers bảo vệ và RPCs `SECURITY DEFINER`. |

---

### 2. 📖 HƯỚNG DẪN SỬ DỤNG THEO NGHIỆP VỤ (Dành cho Nhân sự Trang trại)

| STT | Tài liệu nghiệp vụ | Đối tượng sử dụng | Mô tả chức năng |
|:---:|---|---|---|
| **01** | [**Đăng nhập & Tài khoản**](./user-guide/01-tong-quan-dang-nhap.md) | Tất cả nhân sự | Đăng nhập bằng username không cần email, đổi mật khẩu, cấu hình khu vực. |
| **02** | [**Quản lý Vật tư & Tem QR**](./user-guide/02-quan-ly-vat-tu-qr.md) | Quản kho, Kỹ thuật | Tra cứu danh mục hàng hóa, đơn vị tính, tạo & quét mã QR định danh vật tư. |
| **03** | [**Nhập kho từ Nhà cung cấp**](./user-guide/03-nhap-kho-vat-tu.md) | Quản kho, Kế toán | Tạo phiếu nhập kho, chụp ảnh hóa đơn VAT, tính giá vốn, quản lý nhà cung cấp. |
| **04** | [**Xuất kho & Cấp phát**](./user-guide/04-xuat-kho-cap-phat.md) | Quản kho, Kế toán | Lập phiếu xuất kho nội bộ, xuất bán, trừ tồn kho tự động, in phiếu xuất kho. |
| **05** | [**Yêu cầu Vật tư Chuồng trại**](./user-guide/05-yeu-cau-vat-tu.md) | Công nhân, Kỹ thuật, Quản kho | Lập phiếu xin cấp vật tư định kỳ, duyệt 2 cấp (Kỹ thuật -> Kho), nhận đồ và trả hàng thừa. |
| **06** | [**Đổi 1-1 Cấp tốc & Báo hỏng**](./user-guide/06-doi-1-1-va-bao-hong.md) | Kỹ thuật, Quản kho | Đổi thiết bị hỏng (Motor, quạt, bơm) lấy đồ mới trong 5 phút, gom đồ hỏng về kho tập kết. |
| **07** | [**Sửa chữa & Thanh lý phế liệu**](./user-guide/07-sua-chua-thanh-ly.md) | Kỹ thuật, Quản kho, Chủ trại | Tạo đơn gửi xưởng sửa chữa cơ điện, nghiệm thu đưa lại kho, duyệt thanh lý bán phế liệu. |
| **08** | [**Mượn - Trả Dụng cụ Đồ nghề**](./user-guide/08-muon-tra-dung-cu.md) | Quản kho, Thợ kỹ thuật | Quản lý tủ đồ nghề (máy hàn, máy khoan, thang...), quét QR mượn trả, kiểm soát hạn trả. |
| **09** | [**Trạm Bồn Xăng Dầu & Xe máy**](./user-guide/09-kho-xang-dau-xe.md) | Quản kho dầu, Tài xế, Chủ trại | Quét mã QR dán trên xe, cấp phát dầu Diesel, đo chỉ số ODO/giờ máy, tính định mức tiêu hao. |
| **10** | [**Chuyển kho & Kiểm kê tồn**](./user-guide/10-chuyen-kho-kiem-ke.md) | Quản kho, Kế toán | Điều chuyển giữa các kho cơ sở, mở phiên kiểm kê định kỳ, cân bằng sai lệch kho. |
| **11** | [**Báo cáo Tổng hợp & Phân tích**](./user-guide/11-bao-cao-phan-tich.md) | Chủ trại, Kế toán | Báo cáo chi phí vật tư từng khu chuồng, biến động kho, phân tích xe, xuất file Excel chuẩn. |
| **12** | [**In ấn Phiếu & Tem nhãn QR**](./user-guide/12-in-an-va-tem-nhan.md) | Quản kho, Kế toán, Kỹ thuật | In phiếu nhập/xuất/yêu cầu khổ A4/A5, in tem nhãn QR dán kệ hàng, dán xe, dán dụng cụ. |
| **13** | [**Quy đổi Đơn vị Tính & Đóng gói Đa cấp**](./user-guide/13-quy-doi-don-vi-dong-goi.md) | Quản kho, Kỹ thuật, Công nhân | Hướng dẫn tạo vật tư quy đổi (Thùng/Hộp/ml), chọn đơn vị xin cấp phát, tự động trừ kho chuẩn xác. |

---

### 3. ⚙️ VẬN HÀNH & BẢO TRÌ

| Tài liệu | Nội dung chính |
|---|---|
| [**Sổ tay Vận hành Tóm tắt (1 Trang)**](../SO_TAY_VAN_HANH_TRAI.md) | Tóm tắt 10 tình huống thực tế thường gặp hàng ngày (Cheat-sheet nhanh cho kho và chuồng). |
| [**Quy trình Triển khai (Deployment Runbook)**](./operations/deployment-runbook.md) | Cài đặt Docker, Supabase, Next.js, cấu hình biến môi trường `.env.local`, sao lưu DB. |
| [**Xử lý sự cố (Troubleshooting)**](./operations/troubleshooting.md) | Khắc phục lỗi mất kết nối mạng, reset mật khẩu admin, lỗi khóa ngoại, đồng bộ offline. |

---

## 💡 QUY ƯỚC DÀNH CHO AI AGENT:
Khi đọc và tiếp quản codebase này, AI Agent cần tuân thủ các nguyên tắc cốt lõi:
1. **Phân quyền 7 vai trò:** Không bao giờ tự ý khôi phục role `manager` cũ. Luôn sử dụng `Role` union gồm 7 vai trò chuẩn hóa.
2. **Server Actions:** Mọi mutation trong `src/features/*/actions/` phải kiểm tra quyền caller qua `requireProfile()`, `requireWarehouse()`, `requireManager()`, hoặc helper tương ứng.
3. **Audit Trail:** Tất cả các thao tác thay đổi trạng thái, sửa đổi cấu hình hoặc xóa dữ liệu đều phải ghi vào bảng `audit_logs`.
4. **Bảo toàn dữ liệu:** Không xóa cứng (Hard Delete) người dùng đã có phát sinh chứng từ. Luôn sử dụng cơ chế **Lưu trữ (Archive)** trừ khi được yêu cầu xóa sạch bởi `superuser`.
