# 📚 TỪ ĐIỂN BẢNG CƠ SỞ DỮ LIỆU (DATABASE TABLES DICTIONARY)

> Tài liệu tham chiếu chi tiết toàn bộ 39 bảng cơ sở dữ liệu và 2 views của hệ thống **Minh Tân Phát Supply** trên nền tảng PostgreSQL 17 / Supabase.

---

## MỤC LỤC CÁC PHÂN NHÓM BẢNG
1. [Tổ chức, Người dùng & Kiểm toán (5 bảng)](#1-tổ-chức-người-dùng--kiểm-toán)
2. [Danh mục Hàng hóa & Đối tác (6 bảng)](#2-danh-mục-hàng-hóa--đối-tác)
3. [Kho Hàng & Sổ Cái Tồn Kho (3 bảng + 2 views)](#3-kho-hàng--sổ-cái-tồn-kho)
4. [Phiếu Nhập Kho từ Nhà Cung Cấp (2 bảng)](#4-phiếu-nhập-kho-từ-nhà-cung-cấp)
5. [Phiếu Yêu Cầu & Cấp Phát Xuất Kho (6 bảng)](#5-phiếu-yêu-cầu--cấp-phát-xuất-kho)
6. [Báo Hỏng, Đổi 1-1, Sửa Chữa & Thanh Lý (8 bảng)](#6-báo-hỏng-đổi-1-1-sửa-chữa--thanh-lý)
7. [Dụng Cụ Đồ Nghề (2 bảng)](#7-dụng-cụ-đồ-nghề)
8. [Trạm Bồn Dầu & Xe Cơ Giới (5 bảng)](#8-trạm-bồn-dầu--xe-cơ-giới)
9. [Kiểm Kê Kho & Cân Bằng Tồn (2 bảng)](#9-kiểm-kê-kho--cân-bằng-tồn)

---

## 1. TỔ CHỨC, NGƯỜI DÙNG & KIỂM TOÁN

### `zones` — Khu vực địa lý trang trại
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính khu vực |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã khu vực (VD: `KHU_A`, `KHU_B`, `CO_DIEN`) |
| `name` | `text` | `NOT NULL` | Tên hiển thị (VD: `Khu A - Gà Đẻ`, `Xưởng Cơ Điện`) |
| `description` | `text` | `NULL` | Mô tả chi tiết khu vực |
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

### `notifications` — Thông báo chuông đích danh
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính thông báo |
| `user_id` | `uuid` | `NOT NULL, REFERENCES profiles(id)` | Người nhận thông báo |
| `title` | `text` | `NOT NULL` | Tiêu đề thông báo |
| `message` | `text` | `NOT NULL` | Nội dung chi tiết |
| `type` | `text` | `NOT NULL` | Loại (`info`, `warning`, `success`, `error`) |
| `link` | `text` | `NULL` | Đường dẫn chuyển hướng khi bấm vào |
| `is_read` | `boolean` | `DEFAULT false` | Đã đọc hay chưa |

---

## 2. DANH MỤC HÀNG HÓA & ĐỐI TÁC

### `categories` — Danh mục ngành hàng
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `name` | `text` | `NOT NULL` | Tên ngành hàng (VD: `Cơ điện`, `Thuốc thú y`, `Dụng cụ chuồng`) |
| `icon` | `text` | `NULL` | Mã icon Lucide |
| `display_order`| `integer` | `DEFAULT 0` | Thứ tự hiển thị trên menu |

### `products` — Sản phẩm gốc
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính sản phẩm |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã sản phẩm (VD: `VT-MOTOR-1.5KW`) |
| `name` | `text` | `NOT NULL` | Tên sản phẩm gốc |
| `category_id` | `uuid` | `NULL, REFERENCES categories(id)` | Ngành hàng |
| `base_unit` | `text` | `NOT NULL` | Đơn vị tính cơ sở nhỏ nhất (VD: `Cái`, `Hộp`, `ml`, `Kg`, `Mét`) |
| `image_url` | `text` | `NULL` | Ảnh chụp thực tế của sản phẩm |
| `manage_type` | `text` | `DEFAULT 'single'` | Kiểu quản lý: `single` (lẻ), `conversion` (quy đổi đa cấp), `multiple` (nhiều quy cách), `kit` (bộ) |

### `variants` — Biến thể & Quy cách đóng gói đa cấp
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính biến thể |
| `product_id` | `uuid` | `NOT NULL, REFERENCES products(id)` | Sản phẩm gốc |
| `sku` | `text` | `NOT NULL, UNIQUE` | Mã SKU định danh duy nhất |
| `name` | `text` | `NOT NULL` | Tên quy cách (VD: `Thùng (6 hộp 550ml)`, `Can 5 Lít`, `Bao 25kg`) |
| `unit` | `text` | `NOT NULL` | Tên đơn vị đóng gói |
| `conversion_factor` | `numeric` | `DEFAULT 1.0` | Hệ số quy đổi về đơn vị cơ sở (VD: 1 Thùng = 6 Hộp ➜ factor = 6) |
| `price_buy` | `numeric` | `DEFAULT 0` | Đơn giá mua từ Nhà cung cấp |
| `price_sell` | `numeric` | `DEFAULT 0` | Đơn giá xuất bán thương mại |
| `min_stock` | `numeric` | `DEFAULT 0` | Ngưỡng tồn kho an toàn tối thiểu |
| `is_default` | `boolean` | `DEFAULT false` | Biến thể mặc định |

### `variant_components` — Định mức linh kiện theo bộ (BOM)
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `parent_variant_id` | `uuid` | `REFERENCES variants(id)` | Biến thể cha (Bộ hoàn chỉnh) |
| `child_variant_id` | `uuid` | `REFERENCES variants(id)` | Linh kiện con trực thuộc |
| `quantity` | `numeric` | `NOT NULL` | Số lượng linh kiện cấu thành 1 bộ cha |

### `suppliers` — Danh bạ Nhà Cung Cấp
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính NCC |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã nhà cung cấp (VD: `NCC-PETRO`, `NCC-DIEN-QUANG`) |
| `name` | `text` | `NOT NULL` | Tên công ty / Cửa hàng |
| `phone` | `text` | `NULL` | Số điện thoại liên hệ |
| `address` | `text` | `NULL` | Địa chỉ nhà cung cấp |

### `customers` — Danh bạ Khách hàng thu mua
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính khách hàng |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã khách hàng (VD: `KH-PHAN-BAYTHANG`) |
| `name` | `text` | `NOT NULL` | Tên đại lý / Khách mua |
| `phone` | `text` | `NULL` | Số điện thoại |

---

## 3. KHO HÀNG & SỔ CÁI TỒN KHO

### `stock_locations` — Vị trí kho vật lý
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính kho |
| `code` | `text` | `NOT NULL, UNIQUE` | Mã kho (VD: `MAIN`, `DEFECT`, `REPAIR`, `MEDICINE`) |
| `name` | `text` | `NOT NULL` | Tên kho (Kho Tổng, Kho Hỏng, Kho Sửa Chữa, Kho Thuốc) |
| `type` | `location_type` | `DEFAULT 'main'` | `main` (chính), `defect` (hỏng), `repair` (sửa), `other` |

### `stock_balances` — Tồn kho khả dụng thời gian thực
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `location_id` | `uuid` | `NOT NULL, REFERENCES stock_locations(id)` | Vị trí kho |
| `variant_id` | `uuid` | `NOT NULL, REFERENCES variants(id)` | Biến thể hàng hóa |
| `quantity` | `numeric` | `NOT NULL, DEFAULT 0` | Số lượng tồn kho theo đơn vị cơ sở |

### `stock_movements` — Sổ cái biến động kho (Audit Ledger)
| Cột | Kiểu | Ràng buộc | Diễn giải |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính giao dịch |
| `location_id` | `uuid` | `NOT NULL, REFERENCES stock_locations(id)` | Kho phát sinh biến động |
| `variant_id` | `uuid` | `NOT NULL, REFERENCES variants(id)` | Biến thể |
| `quantity_change` | `numeric` | `NOT NULL` | Số lượng thay đổi (+ tăng, - giảm) |
| `movement_type` | `movement_type` | `NOT NULL` | `receipt_in`, `issue_out`, `transfer_in`, `transfer_out`, `defect_in`, `defect_out`, `repair_in`, `repair_out`, `stocktake_adjust`, `revert` |
| `reference_type`| `text` | `NOT NULL` | Bảng chứng từ gốc (`receipts`, `issues`, `requisitions`...) |
| `reference_id` | `uuid` | `NOT NULL` | Khóa chính chứng từ gốc |
| `balance_after` | `numeric` | `NOT NULL` | Số dư tồn kho ngay sau giao dịch |
| `created_by` | `uuid` | `REFERENCES profiles(id)` | Người thực hiện giao dịch |