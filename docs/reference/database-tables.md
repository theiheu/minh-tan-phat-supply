# 📚 TỪ ĐIỂN BẢNG CƠ SỞ DỮ LIỆU (DATABASE TABLES DICTIONARY)

> Tài liệu tham chiếu chi tiết toàn bộ các bảng cơ sở dữ liệu và views của hệ thống **Minh Tân Phát Supply** trên nền tảng PostgreSQL 17 / Supabase.

---

## MỤC LỤC CÁC PHÂN NHÓM BẢNG
1. [Tổ chức, Người dùng, Phân quyền & Kiểm toán (6 bảng)](#1-tổ-chức-người-dùng-phân-quyền--kiểm-toán)
2. [Danh mục Hàng hóa, SKU, Thuộc tính & BOM (9 bảng)](#2-danh-mục-hàng-hóa-sku-thuộc-tính--bom)
3. [Đối tác Nhà Cung Cấp & Khách Hàng (2 bảng)](#3-đối-tác-nhà-cung-cấp--khách-hàng)
4. [Kho Hàng, Sổ Cái Tồn Kho & Lô Hàng (5 bảng + 2 views)](#4-kho-hàng-sổ-cái-tồn-kho--lô-hàng)
5. [Phiếu Nhập Kho từ Nhà Cung Cấp (2 bảng)](#5-phiếu-nhập-kho-từ-nhà-cung-cấp)
6. [Phiếu Yêu Cầu & Hoàn Trả Vật Tư (4 bảng)](#6-phiếu-yêu-cầu--hoàn-trả-vật-tư)
7. [Phiếu Xuất Kho Cấp Phát & Bán Hàng (2 bảng)](#7-phiếu-xuất-kho-cấp-phát--bán-hàng)
8. [Báo Hỏng, Đổi 1-1, Sửa Chữa & Thanh Lý (8 bảng)](#8-báo-hỏng-đổi-1-1-sửa-chữa--thanh-lý)
9. [Dụng Cụ Đồ Nghề Dùng Chung (3 bảng)](#9-dụng-cụ-đồ-nghề-dùng-chung)
10. [Trạm Bồn Dầu & Xe Cơ Giới (5 bảng)](#10-trạm-bồn-dầu--xe-cơ-giới)
11. [Kiểm Kê Kho Định Kỳ (2 bảng)](#11-kiểm-kê-kho-định-kỳ)
12. [AI Copilot & Tri Thức Vector (6 bảng)](#12-ai-copilot--tri-thức-vector)

---

## 1. TỔ CHỨC, NGƯỜI DÙNG, PHÂN QUYỀN & KIỂM TOÁN

### `zones` — Khu vực địa lý trang trại
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính khu vực |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã khu vực (VD: `KHU_A`, `KHU_B`, `CO_DIEN`, `TRAM_DAU`) |
| `name` | `text` | `NOT NULL` | Tên hiển thị (VD: `Khu A - Gà Đẻ`, `Xưởng Cơ Điện`) |
| `description` | `text` | `NULL` | Mô tả chi tiết |
| `created_at` | `timestamptz` | `DEFAULT now()` | Thời điểm tạo |

### `sub_zones` — Dãy chuồng / Phân xưởng trực thuộc
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính dãy chuồng |
| `zone_id` | `uuid` | `NOT NULL, REFERENCES zones(id)` | Khóa ngoại thuộc Khu vực nào |
| `code` | `text` | `NOT NULL` | Mã dãy chuồng (VD: `A1`, `A2`, `B1`) |
| `name` | `text` | `NOT NULL` | Tên dãy chuồng (VD: `Chuồng A1`, `Chuồng A2`) |
| `description` | `text` | `NULL` | Ghi chú thêm |

### `profiles` — Thông tin định danh & Phân quyền nhân sự
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, REFERENCES auth.users(id)` | Khóa chính liên kết GoTrue Auth |
| `name` | `text` | `NOT NULL` | Họ và tên nhân viên (Khóa bất biến qua Trigger) |
| `username` | `text` | `NOT NULL, UNIQUE` | Tên đăng nhập (Khóa bất biến qua Trigger) |
| `email` | `text` | `NULL` | Email nhận thông báo qua SMTP |
| `role` | `text` | `NOT NULL, DEFAULT 'requester'` | 1 trong 7 vai trò (`superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester`, `driver`) |
| `zone_id` | `uuid` | `NULL, REFERENCES zones(id)` | Khu vực công tác mặc định |
| `is_active` | `boolean` | `DEFAULT true` | `true` = Đang làm việc, `false` = Nghỉ việc / Lưu trữ |
| `is_protected`| `boolean` | `DEFAULT false` | `true` = Tài khoản hệ thống gốc được bảo vệ chống xóa/khóa |

### `audit_logs` — Sổ nhật ký kiểm toán hệ thống
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính log |
| `actor_id` | `uuid` | `NULL, REFERENCES profiles(id)` | Người thực hiện hành động |
| `action` | `text` | `NOT NULL` | Loại hành động (CREATE, UPDATE, DELETE, ARCHIVE, APPROVE, FORCE_PURGE) |
| `entity_type` | `text` | `NOT NULL` | Tên bảng bị tác động (`profiles`, `receipts`, `stock_balances`...) |
| `entity_id` | `text` | `NULL` | Khóa chính của bản ghi bị tác động |
| `before` | `jsonb` | `NULL` | Dữ liệu cũ trước khi sửa |
| `after` | `jsonb` | `NULL` | Dữ liệu mới sau khi sửa |

### `notifications` — Thông báo chuông đích danh trong app
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính thông báo |
| `user_id` | `uuid` | `NOT NULL, REFERENCES profiles(id)` | Người nhận thông báo |
| `title` | `text` | `NOT NULL` | Tiêu đề thông báo |
| `message` | `text` | `NOT NULL` | Nội dung chi tiết |
| `type` | `text` | `NOT NULL` | Loại (`info`, `warning`, `success`, `error`) |
| `link` | `text` | `NULL` | Đường dẫn chuyển hướng khi bấm vào |
| `is_read` | `boolean` | `DEFAULT false` | Đã đọc hay chưa |

### `email_delivery_attempts` — Nhật ký phân phối email SMTP
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `recipient` | `text` | `NOT NULL` | Địa chỉ email người nhận |
| `subject` | `text` | `NOT NULL` | Tiêu đề email |
| `status` | `text` | `NOT NULL` | `pending`, `sent`, `failed` |
| `error_message` | `text` | `NULL` | Chi tiết lỗi nếu gửi thất bại |
| `attempt_count` | `integer` | `DEFAULT 0` | Số lần thử lại |

---

## 2. DANH MỤC HÀNG HÓA, SKU, THUỘC TÍNH & BOM

### `categories` — Danh mục ngành hàng
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính ngành hàng |
| `name` | `text` | `NOT NULL` | Tên ngành hàng (VD: `Cơ điện`, `Thuốc thú y`) |
| `icon` | `text` | `NULL` | Tên icon Lucide |
| `display_order` | `integer` | `DEFAULT 0` | Thứ tự hiển thị |

### `products` — Sản phẩm gốc (Catalog Product Identity)
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính sản phẩm |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã sản phẩm (VD: `VT-MOTOR-1.5KW`) |
| `name` | `text` | `NOT NULL` | Tên sản phẩm gốc |
| `category_id` | `uuid` | `NULL, REFERENCES categories(id)` | Ngành hàng |
| `base_unit` | `text` | `NOT NULL` | Tên đơn vị tính cơ sở |
| `manage_type` | `text` | `DEFAULT 'single'` | `single` (lẻ), `conversion` (quy đổi), `multiple` (nhiều quy cách), `kit` (bộ) |
| `image_url` | `text` | `NULL` | Ảnh sản phẩm đại diện |
| `is_active` | `boolean` | `DEFAULT true` | Đang kinh doanh hay ngừng |

### `units` — Đơn vị tính chuẩn hóa (Canonical Units)
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã đơn vị (VD: `cai`, `kg`, `lit`, `thung`) |
| `name` | `text` | `NOT NULL` | Tên hiển thị (Cái, Kg, Lít, Thùng) |
| `symbol` | `text` | `NULL` | Ký hiệu viết tắt |

### `skus` — Dòng hàng SKU lưu kho duy nhất
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính SKU |
| `product_id` | `uuid` | `NOT NULL, REFERENCES products(id)` | Sản phẩm gốc |
| `sku_code` | `text` | `NOT NULL, UNIQUE` | Mã SKU định danh duy nhất |
| `name` | `text` | `NOT NULL` | Tên đầy đủ của SKU |
| `base_unit_id` | `uuid` | `NOT NULL, REFERENCES units(id)` | Đơn vị cơ sở giữ tồn |
| `kit_type` | `text` | `DEFAULT 'none'` | `none` (thường), `virtual` (bộ ảo), `assembled` (bộ ráp) |
| `cost_price` | `numeric` | `DEFAULT 0` | Giá vốn mua |
| `selling_price`| `numeric` | `DEFAULT 0` | Giá xuất bán |
| `min_stock` | `numeric` | `DEFAULT 0` | Ngưỡng tồn an toàn tối thiểu |

### `sku_transaction_units` — Quy đổi đơn vị đóng gói đa cấp
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `sku_id` | `uuid` | `NOT NULL, REFERENCES skus(id)` | Khóa ngoại SKU |
| `unit_id` | `uuid` | `NOT NULL, REFERENCES units(id)` | Đơn vị quy đổi (VD: Thùng) |
| `conversion_rate` | `numeric` | `NOT NULL, CHECK > 0` | Hệ số nhân về Base UOM (1 Thùng = 6 Hộp ➜ rate = 6) |

### `attribute_definitions` & `sku_attribute_values` — Thuộc tính kỹ thuật
| Bảng | Cột chính | Diễn giải |
|---|---|---|
| `attribute_definitions` | `id, code, name, data_type, is_variant_axis` | Định nghĩa thuộc tính (Hãng, Công suất, Kích cỡ) |
| `sku_attribute_values` | `sku_id, attribute_id, value_text, value_number` | Giá trị cụ thể gắn cho SKU |

### `bom_headers`, `bom_versions`, `bom_items` — Định mức linh kiện (BOM)
| Bảng | Cột chính | Diễn giải |
|---|---|---|
| `bom_headers` | `id, parent_sku_id, name` | Header định mức linh kiện của SKU cha |
| `bom_versions` | `id, header_id, version_number, is_active` | Phiên bản BOM (hỗ trợ versioning bảo toàn lịch sử) |
| `bom_items` | `id, version_id, component_sku_id, quantity` | Chi tiết linh kiện con và số lượng cấu thành |

---

## 3. ĐỐI TÁC NHÀ CUNG CẤP & KHÁCH HÀNG

### `suppliers` — Danh bạ Nhà Cung Cấp
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã nhà cung cấp (VD: `NCC-PETRO`, `NCC-TAMHUNG`) |
| `name` | `text` | `NOT NULL` | Tên đầy đủ công ty / cửa hàng |
| `contact_person`| `text` | `NULL` | Người liên hệ |
| `phone` | `text` | `NULL` | Số điện thoại |
| `address` | `text` | `NULL` | Địa chỉ kinh doanh |

### `customers` — Danh bạ Khách Hàng
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã khách hàng |
| `name` | `text` | `NOT NULL` | Tên khách hàng / Đại lý / Thương lái |
| `phone` | `text` | `NULL` | Số điện thoại |
| `address` | `text` | `NULL` | Địa chỉ |

---

## 4. KHO HÀNG, SỔ CÁI TỒN KHO & LÔ HÀNG

### `stock_locations` — Vị trí kho vật lý
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `code` | `text` | `NOT NULL, UNIQUE` | `KHO_TONG`, `KHO_CO_DIEN`, `KHO_HONG`, `TRAM_DAU` |
| `name` | `text` | `NOT NULL` | Tên kho |
| `type` | `location_type` | `NOT NULL` | `main`, `defect`, `repair`, `other` |

### `stock_balances` — Tồn kho khả dụng thời gian thực
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `location_id` | `uuid` | `REFERENCES stock_locations(id)` | Vị trí kho |
| `sku_id` | `uuid` | `REFERENCES skus(id)` | SKU lưu kho |
| `quantity` | `numeric` | `NOT NULL, DEFAULT 0` | Số lượng tồn theo Base UOM |

### `stock_movements` — Sổ cái biến động kho Append-Only
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính movement |
| `location_id` | `uuid` | `NOT NULL, REFERENCES stock_locations(id)` | Vị trí kho biến động |
| `sku_id` | `uuid` | `NOT NULL, REFERENCES skus(id)` | SKU biến động |
| `quantity_change`| `numeric` | `NOT NULL` | Số lượng (+ tăng, - giảm) |
| `movement_type` | `movement_type` | `NOT NULL` | `receipt_in`, `issue_out`, `exchange_out`, `defect_collect_in`, `transfer_out`, `transfer_in`, `stocktake_adjust`, `revert_reversal`... |
| `reference_type`| `text` | `NOT NULL` | Tên bảng chứng từ phát sinh (`receipts`, `issues`, `requisitions`...) |
| `reference_id` | `uuid` | `NOT NULL` | Khóa chính chứng từ phát sinh |
| `balance_after` | `numeric` | `NOT NULL` | Số dư tồn kho tức thời sau biến động |
| `created_by` | `uuid` | `REFERENCES profiles(id)` | Nhân sự thực hiện |
| `created_at` | `timestamptz` | `DEFAULT now()` | Thời điểm ghi sổ |

---

## 5. PHIẾU NHẬP KHO TỪ NHÀ CUNG CẤP

### `receipts` — Phiếu Nhập Kho
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã phiếu (VD: `NK-202609-001`) |
| `supplier_id` | `uuid` | `NOT NULL, REFERENCES suppliers(id)` | Nhà cung cấp |
| `location_id` | `uuid` | `NOT NULL, REFERENCES stock_locations(id)` | Kho nhập hàng |
| `status` | `receipt_status` | `DEFAULT 'draft'` | `draft`, `posted`, `cancelled` |
| `invoice_no` | `text` | `NULL` | Số hóa đơn VAT / Phiếu giao hàng |
| `invoice_images`| `text[]` | `DEFAULT '{}'` | Danh sách đường dẫn ảnh hóa đơn trên Supabase Storage |
| `total_amount` | `numeric` | `DEFAULT 0` | Tổng giá trị tiền hàng |
| `created_by` | `uuid` | `REFERENCES profiles(id)` | Người lập phiếu |

### `receipt_items` — Chi tiết hàng nhập
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính dòng |
| `receipt_id` | `uuid` | `NOT NULL, REFERENCES receipts(id)` | Khóa ngoại phiếu nhập |
| `sku_id` | `uuid` | `NOT NULL, REFERENCES skus(id)` | SKU nhập |
| `quantity` | `numeric` | `NOT NULL, CHECK > 0` | Số lượng nhập |
| `unit_cost` | `numeric` | `NOT NULL, DEFAULT 0` | Đơn giá mua |
| `lot_number` | `text` | `NULL` | Số lô hàng |
| `expiry_date` | `date` | `NULL` | Hạn sử dụng |

---

## 6. PHIẾU YÊU CẦU & HOÀN TRẢ VẬT TƯ

### `requisitions` — Phiếu Yêu Cầu Cấp Phát
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã phiếu (VD: `REQ-202609-001`) |
| `requester_id` | `uuid` | `NOT NULL, REFERENCES profiles(id)` | Người lập yêu cầu |
| `zone_id` | `uuid` | `NOT NULL, REFERENCES zones(id)` | Khu vực nhận |
| `sub_zone_id` | `uuid` | `NULL, REFERENCES sub_zones(id)` | Dãy chuồng nhận chi tiết |
| `priority` | `text` | `DEFAULT 'normal'` | `normal`, `urgent` |
| `status` | `requisition_status` | `DEFAULT 'draft'` | `draft`, `pending`, `approved`, `issued`, `received`, `rejected`, `cancelled` |
| `invoice_images`| `text[]` | `DEFAULT '{}'` | Ảnh chứng từ/hóa đơn đính kèm |

### `requisition_returns` & `requisition_return_items` — Hoàn trả vật tư thừa
| Bảng | Cột chính | Diễn giải |
|---|---|---|
| `requisition_returns` | `id, code, requisition_id, returned_by, location_id, status` | Phiếu hoàn trả vật tư dùng thừa về kho |
| `requisition_return_items` | `id, return_id, sku_id, quantity` | Chi tiết số lượng SKU hoàn trả |

---

## 7. PHIẾU XUẤT KHO CẤP PHÁT & BÁN HÀNG

### `issues` & `issue_items` — Xuất Kho Trực Tiếp
| Bảng | Cột chính | Diễn giải |
|---|---|---|
| `issues` | `id, code, destination_type, zone_id, sub_zone_id, customer_id, location_id, status, notes, invoice_images` | Phiếu xuất kho nội bộ theo dãy chuồng hoặc xuất bán |
| `issue_items` | `id, issue_id, sku_id, quantity, unit_price` | Chi tiết hàng xuất và đơn giá |

---

## 8. BÁO HỎNG, ĐỔI 1-1, SỬA CHỮA & THANH LÝ

| Bảng | Cột chính | Diễn giải |
|---|---|---|
| `defect_notes` | `id, code, zone_id, sub_zone_id, reporter_id, status` | Phiếu báo hỏng thiết bị tại chuồng |
| `defect_note_items`| `id, defect_note_id, sku_id, quantity, damage_type, severity, images, note` | Chi tiết thiết bị hỏng kèm ảnh hiện trường |
| `exchange_notes` | `id, code, defect_note_id, source_location_id, defect_location_id, status` | Phiếu đổi 1-1 cấp tốc 30s |
| `exchange_note_items`| `id, exchange_id, sku_id, quantity` | Chi tiết thiết bị đổi mới |
| `repair_orders` | `id, code, vendor_name, status, cost, notes` | Đơn gửi thiết bị đi sửa xưởng ngoài |
| `repair_order_items`| `id, repair_order_id, defect_note_item_id, outcome` | Chi tiết thiết bị sửa và kết quả nghiệm thu |
| `liquidation_notes`| `id, code, buyer_name, total_revenue, status` | Phiếu bán thanh lý phế liệu ve chai |
| `liquidation_items`| `id, liquidation_id, defect_note_item_id, quantity, revenue` | Chi tiết món thanh lý |

---

## 9. DỤNG CỤ ĐỒ NGHỀ DÙNG CHUNG

| Bảng | Cột chính | Diễn giải |
|---|---|---|
| `tool_borrowings` | `id, code, borrower_id, zone_id, due_date, status, returned_at` | Phiếu mượn dụng cụ đồ nghề |
| `tool_borrowing_items`| `id, borrowing_id, sku_id, quantity, returned_quantity` | Chi tiết dụng cụ và số lượng mượn/trả |
| `tool_reminder_claims`| `id, borrowing_id, claimed_at` | Khóa chống lặp email nhắc nợ dụng cụ |

---

## 10. TRẠM BỒN DẦU & XE CƠ GIỚI

| Bảng | Cột chính | Diễn giải |
|---|---|---|
| `vehicles` | `id, code, name, type, license_plate, calc_unit, standard_rate, last_meter, qr_text, document_images` | Dàn xe cơ giới, định mức tiêu hao và ảnh cà vẹt |
| `fuel_types` | `id, code, name, unit, is_active` | Danh mục loại nhiên liệu (Dầu DO 0.05S) |
| `fuel_receipts` | `id, code, fuel_type_id, quantity, unit_cost, supplier_name, invoice_no` | Phiếu xe bồn Petrolimex nhập dầu vào trạm |
| `fuel_dispenses`| `id, code, vehicle_id, fuel_type_id, dispensed_liters, current_meter, prev_meter, distance_or_hours, consumption_rate, status` | Lượt quét QR bơm dầu xe |
| `fuel_movements`| `id, fuel_type_id, quantity_change, movement_type, reference_id, balance_after` | Sổ cái biến động bồn dầu |

---

## 11. KIỂM KÊ KHO ĐỊNH KỲ

| Bảng | Cột chính | Diễn giải |
|---|---|---|
| `stocktake_sessions`| `id, code, location_id, status, conducted_by, approved_by, notes` | Phiên kiểm kê kho |
| `stocktake_items` | `id, session_id, sku_id, system_qty, actual_qty, difference, reason, image_url` | Chi tiết đếm thực tế và chênh lệch |

---

## 12. AI COPILOT & TRI THỨC VECTOR

| Bảng | Cột chính | Diễn giải |
|---|---|---|
| `ai_knowledge_documents`| `id, title, category, source_key, content_hash` | Tài liệu SOP vận hành trại |
| `ai_knowledge_chunks` | `id, document_id, chunk_index, content, embedding, tsv` | Phân mảnh văn bản và vector 1536 chiều |
| `ai_conversations` | `id, user_id, title, created_at` | Phiên hội thoại với AI |
| `ai_messages` | `id, conversation_id, role, content, tool_calls, tool_results` | Lịch sử tin nhắn hội thoại |
| `ai_quick_prompts` | `id, label, prompt, icon, display_order, is_active` | Câu hỏi mẫu cài sẵn |
| `ai_rate_limits` | `id, user_id, window_start, request_count` | Bộ đếm giới hạn tốc độ gọi API AI |
