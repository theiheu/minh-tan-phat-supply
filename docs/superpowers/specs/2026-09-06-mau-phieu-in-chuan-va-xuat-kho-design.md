# Đặc tả: Mẫu phiếu in chuẩn cho mọi loại phiếu + Module xuất kho + Bảng tồn

Ngày: 2026-09-06 · Trạng thái: chờ duyệt · Phạm vi: repo `minh-tan-phat-supply`

## 1. Bối cảnh & mục tiêu

Hiện mỗi loại phiếu in tự dựng layout riêng (`src/features/pdf/slip.tsx` dùng chung cho Nhập/Hỏng/Sửa/Thanh lý nhưng đầu đề sai thương hiệu; `src/features/requisitions/components/requisition-pdf.tsx` là bản sao lệch kiểu). Anh muốn lấy **mẫu Phiếu xuất kho giấy của trại** làm chuẩn cho **mọi phiếu in**:

- Xuất, nhập, yêu cầu, hỏng/sửa/thanh lý, kiểm kê, bảng tồn — cùng một khung mẫu; **mỗi loại tự khai báo cột/thông tin**.
- Đầu mọi phiếu: **TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG** · Ấp Tân Tiến, xã Minh Tân, huyện Dầu Tiếng, tỉnh Bình Dương · SĐT 0988 365 238 – 0963 077 879 (+ logo, anh gửi file sau).
- Kèm module **Phiếu xuất kho** mới (1 loại phiếu, 2 kiểu đích: **Khu nội bộ** / **Khách hàng ngoài**) và bản in **Bảng tồn kho theo kho**.

## 2. Phạm vi

**Trong phạm vi**
1. Component in chuẩn dùng chung + chuyển đổi 5 phiếu hiện có: Nhập kho (receipts), Yêu cầu vật tư (requisitions), Vật tư hỏng (defects), Sửa chữa (repairs), Thanh lý (liquidations).
2. Module Phiếu xuất kho mới (DB → UI → in): đích = Khu nội bộ (không giá) hoặc Khách hàng (có giá bán).
3. Bảng khách hàng (`customers`) quản lý như nhà cung cấp.
4. In PDF "Bảng tồn kho hiện tại theo kho" từ màn Báo cáo/Tồn kho.
5. Thêm nút "In phiếu kiểm kê" theo mẫu chuẩn (màn Kiểm kê hiện chưa in được).
6. Tiện ích đọc số tiền bằng chữ (tiếng Việt) phục vụ dòng "Thành tiền bằng chữ".

**Ngoài phạm vi (nói rõ để không ngầm hiểu)**
- **Phiếu chuyển kho**: hệ thống không lưu phiếu chuyển (chỉ ghi sổ `stock_movements`, `ref_id` null) nên không có gì để in — giữ nguyên.
- Công nợ / thanh toán / thu tiền khách; hoá đơn VAT; giảm giá; truy vết xuất theo lô/hạn dùng; quản lý tài xế/xe thành danh mục (chỉ nhập chữ tự do trên phiếu).

## 3. Phần A — Mẫu in chuẩn dùng chung

### A1. Bố cục (bám mẫu phiếu giấy)

```
┌──────────────────────────────────────────────────────────────┐
│ [logo]  TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG            Số phiếu: PXK-0001│
│         Ấp Tân Tiến, xã Minh Tân, huyện Dầu Tiếng, tỉnh Bình Dương │
│         SĐT: 0988 365 238 – 0963 077 879                     │
├──────────────────────────────────────────────────────────────┤
│                      PHIẾU XUẤT KHO (đậm, giữa, cỡ lớn)       │
│               Ngày 06 tháng 09 năm 2026 (tự điền)            │
│ ┌──────────────────────────────┬────────────────────────────┐ │
│ │ Bên nhận hàng: …             │ Thông tin xe vận chuyển   │ │
│ │ Địa chỉ: …                   │  • Biển số xe: …           │ │
│ │ Số điện thoại: …             │  • Người vận chuyển: …     │ │
│ └──────────────────────────────┴────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────┐│
│ │STT│ TÊN SẢN PHẨM, HÀNG HÓA │ĐVT│SL│ĐƠN GIÁ│THÀNH TIỀN│GHI CHÚ││
│ │ 1 │ …                      │…  │… │ …     │ …       │ …    ││
│ │ …                                                          ││
│ │ TỔNG CỘNG                        SL: n         … đồng      ││
│ └────────────────────────────────────────────────────────────┘│
│ Thành tiền bằng chữ: …………………………………………………                         │
│ ┌──────────┬──────────┬──────────────────┬──────────┐         │
│ │Người nhận│ Vận      │ Người lập phiếu  │ Chủ trại │         │
│ │ hàng     │ chuyển   │ (Đại diện người  │          │         │
│ │          │          │ bán)             │          │         │
│ └──────────┴──────────┴──────────────────┴──────────┘         │
└──────────────────────────────────────────────────────────────┘
```

- Khung ngoài viền mỏng bao quanh nội dung phiếu (kiểu mẫu giấy), A4.
- Dòng tiêu đề tên phiếu in hoa, đậm, cỡ ~16–18pt; tên trại ~13–14pt đậm.
- Mỗi loại phiếu khai báo: `title`, vùng field trái `[{label, value}]`, ô phải tuỳ chọn `{title, fields[]}`, bảng `columns[{label, flex, align?}]` + `rows`, dòng tổng tuỳ chọn, `amountInWords?`, `signers[]`, cờ `showCode/dateLine`.

### A2. Khối tiêu đề cố định (mọi phiếu)
- Dòng 1 (đậm): `TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG`
- Dòng 2: `Ấp Tân Tiến, xã Minh Tân, huyện Dầu Tiếng, tỉnh Bình Dương`
- Dòng 3: `SĐT: 0988 365 238 – 0963 077 879`
- Logo: nếu tồn tại file `public/brand/logo.png` (hoặc do anh chốt) thì vẽ bên trái khối chữ; chưa có file → in không logo, không lỗi.
- Góc phải trên: `Số phiếu: <code>` (mã hệ thống, in hoa, vd `GRN-0001`, `PXK-0001`, `REQ-0001`…).
- Dòng ngày dưới tiêu đề: tự điền `Ngày <dd> tháng <mm> năm <yyyy>` từ `created_at` (múi +07).

### A3. Engine kỹ thuật
- **Thay** nội dung `src/features/pdf/slip.tsx` bằng component cấu hình `StandardSlip`; **giữ nguyên tên export `SlipDocument`** (đổi chữ ký props) để 5 route cũ không phải đổi import — chỉ sửa props truyền vào.
- **Xoá/bỏ dùng** `requisition-pdf.tsx`, route yêu cầu chuyển sang `StandardSlip` qua config.
- Tập config `src/features/pdf/standards.ts`: một mục cấu hình cho từng loại phiếu (receipt, requisition, defect, repair, liquidation, issue, stocktake, stock-sheet) gồm toàn bộ A1 fields/columns/signers; route PDF chỉ nạp dữ liệu → đổ vào config (giữ nguyên truy vấn Supabase hiện có).
- Font: tiếp tục họ "Roboto" qua `src/features/pdf/fonts.ts` (có sẵn, hỗ trợ dấu tiếng Việt).
- Phân trang: bảng quá dài phải lặp tiêu đề cột ở trang sau; chân trang ghi `Trang x/y` + `Số phiếu`.
- Tiền: `formatVnd` hiện có (… `đ`). Số lượng cột phải (SL) căn phải. Dòng tổng: bên trái ghi `TỔNG CỘNG` (+ tổng SL nếu không có tiền), bên phải tổng tiền.

### A4. Chữ ký & chữ thường theo loại
| Loại phiếu | Vai trò chữ ký (giữ nguyên hiện có) |
|---|---|
| Nhập kho | Người lập · Thủ kho · Người duyệt |
| Yêu cầu vật tư | Người yêu cầu · Người duyệt · Người cấp phát · Người nhận |
| Vật tư hỏng | Người báo · Người xác nhận |
| Sửa chữa | Người gửi · Đơn vị sửa · Người nhận lại |
| Thanh lý | (giữ vai trò đang in của route thanh lý) |
| Xuất kho – khách hàng | Người nhận hàng · Vận chuyển · Người lập phiếu (Đại diện người bán) · Chủ trại |
| Xuất kho – khu nội bộ | Người nhận · Người lập phiếu · Chủ trại (bỏ ô Vận chuyển) |
| Kiểm kê | Người kiểm kê · Thủ kho · Người duyệt |
| Bảng tồn | không chữ ký (bảng thông tin) |

## 4. Phần B — Chuyển đổi phiếu hiện có

Các route PDF (giữ nguyên URL, quyền, truy vấn) chỉ đổi phần render sang config chuẩn:
- `src/app/api/receipts/[id]/pdf/route.tsx` → "PHIẾU NHẬP KHO"; field trái: Nhà cung cấp (+ địa chỉ/SĐT nhà cung cấp nếu có trong `suppliers`), Người lập, Ghi chú; cột hiện có giữ nguyên (Tên vật tư, Biến thể, ĐVT, SL, Đơn giá, Thành tiền, Lô, Hạn dùng); tổng tiền + thành tiền bằng chữ.
- `src/app/api/requisitions/[id]/pdf/route.tsx` → "PHIẾU YÊU CẦU VẬT TƯ"; field: Người yêu cầu, Khu vực, Loại, Mục đích, Trạng thái; cột hiện có; signers 4 vai trò ở A4. Quyền giữ nguyên (owner-or-manager).
- defects → "PHIẾU GHI NHẬN VẬT TƯ HỎNG" (Kho nguồn, Người báo…).
- repairs → "PHIẾU SỬA CHỮA" (Đơn vị sửa, Ngày gửi, Dự kiến về…).
- liquidations → giữ tiêu đề/field đang in, đổi khung.

Thêm "In" trên các màn đang có nút PDF; giữ nguyên vị trí nút.

## 5. Phần C — Module Phiếu xuất kho

### C1. Bảng `customers`
Mô phỏng `suppliers` (migration `0003`), dùng cho "Bên nhận hàng" khi xuất bán:
```
customers(id uuid pk, name text not null, phone text, address text,
          notes text, is_active bool not null default true,
          deleted_at timestamptz, created_at timestamptz default now())
```
- `name` UNIQUE (trong số active) như suppliers; soft-delete qua `deleted_at`.
- RLS: đọc cho authenticated, ghi manager — sao chép chính sách suppliers.
- UI: trang `/admin/customers` (mô phỏng `/admin/suppliers`), thêm mục ADMIN_NAV "Khách hàng".

### C2. Bảng `issues` + `issue_items`
Mô phỏng `receipts`/`receipt_items` (migration `0010`):
```
issues(id uuid pk, code text unique not null,            -- PXK-####
       destination_type text not null check in ('zone','customer'),
       zone_id uuid null references zones,                -- khi nội bộ
       customer_id uuid null references customers,        -- khi bán
       vehicle_plate text null, driver_name text null,    -- tuỳ chọn (khách)
       creator_id uuid not null references profiles,
       notes text, status text not null default 'draft'
         check in ('draft','posted','cancelled'),
       created_at timestamptz default now())
-- CHECK: (destination_type='zone' and zone_id not null and customer_id is null)
--     or (destination_type='customer' and customer_id not null and zone_id is null)
issue_items(id uuid pk, issue_id uuid not null references issues on delete cascade,
            variant_id uuid not null references variants,
            quantity int not null check (quantity > 0),
            unit_price numeric(12,2) null,   -- bắt buộc về nghĩa khi bán; cho phép null (0) lúc lập
            created_at timestamptz default now())
```
- Có `issues_seq` (prefix `PXK`), đăng ký RLS manager-only + audit như receipts.
- Không có cột giá bán riêng cho sản phẩm: **giá mặc định khi thêm dòng = `variants.price`**, sửa được trên dòng; snapshot lưu vào `issue_items.unit_price` (giá thay đổi sau này không ảnh hưởng phiếu cũ).
- Trạng thái: `Nháp → Đã xuất (posted) → Đã hủy (cancelled, chỉ khi còn Nháp)`. Giống receipts: sau khi đã post **không** có huỷ/hoàn (an toàn kho đơn giản); muốn nhập lại hàng thì dùng phiếu nhập/điều chỉnh.

### C3. Ledger
- Thêm giá trị enum `issue_out` vào `movement_type` (ALTER TYPE additive — an toàn với DB đang chạy).
- Chốt phiếu gọi `_move_stock(variant, KHO_CHINH, null, qty, 'issue_out', 'issue', issue_id, by)` theo từng dòng, khoá thứ tự `variant_id` (chống deadlock như `fulfill_requisition`).
- Hàng **composite** (bộ lắp ráp): bung nhu cầu về linh kiện như `_effective_demand` hiện tại — cần hàm helper tái sử dụng cho danh sách `(variant_id, qty)` bất kỳ (đặt tên, ví dụ `_expand_variant_demand`, hoặc chuyển `_effective_demand` thành dùng chung khi code).

### C4. RPC (security definer, `is_manager()`, có `next_code`)
- `create_issue(p_items jsonb, p_destination_type text, p_zone_id uuid, p_customer_id uuid, p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid) → uuid` — tạo draft, sinh code.
- `post_issue(p_id uuid, p_by uuid)` — draft→posted; kiểm tra đủ tồn từng linh kiện; trừ kho + ghi `stock_movements` + `audit_logs`; nếu thiếu tồn → raise `Không đủ tồn kho` và không chốt nửa chừng (giao dịch nguyên khối).
- `cancel_issue(p_id uuid, p_by uuid)` — chỉ draft→cancelled.

### C5. UI & quyền
- MAIN_NAV: mục "Phiếu xuất" (`/issues`, icon `PackageMinus`/tương tự, roles manager) — đặt cạnh "Phiếu nhập".
- Trang: `/issues` (danh sách: mã, kiểu đích, bên nhận, ngày, trạng thái, tổng SL/tiền, nút In/Xem), `/issues/new` (biểu mẫu), `/issues/[id]` (chi tiết + nút in + post/cancel).
- Mẫu lập phiếu: chọn **Kiểu đích** (Khu nội bộ / Khách hàng) → chọn khu hoặc khách (combo có nút thêm khách nhanh mở dialog nhỏ giống thêm supplier nhanh nếu có sẵn, nếu không thì tạo khách ở trang admin rồi chọn); dòng hàng: chọn hàng + biến thể, tự điền giá (chỉ kiểu khách) & sửa; ô xe/tài xế hiện khi kiểu khách (tuỳ chọn, để trống được).
- Server actions `src/features/issues/actions.ts` (pattern `"use server"` + zod schema + rpc + revalidate) — sao chép cấu trúc `receipts/actions.ts`.
- Zod schema `src/features/issues/schema.ts` tương ứng.
- DB types: cập nhật `src/types/database.types.ts` (typegen sau migration).

### C6. PDF phiếu xuất
- Route `src/app/api/issues/[id]/pdf/route.tsx` (manager).
- Bảng cột theo kiểu đích: khách → `STT | TÊN SẢN PHẨM, HÀNG HÓA | ĐVT | SL | ĐƠN GIÁ | THÀNH TIỀN | GHI CHÚ`; khu → bỏ 2 cột giá, chân bảng ghi tổng SL.
- Vùng trái: khách → `Bên nhận hàng` (tên), `Địa chỉ`, `Số điện thoại` (lấy từ customers); khu → `Nhận tại khu` (tên khu). Ô phải "Thông tin xe vận chuyển" (2 dòng: Biển số xe / Người vận chuyển) chỉ khi có giá trị.
- `Thành tiền bằng chữ:` khi có tổng tiền (chỉ kiểu khách).
- Chữ ký theo A4.

## 6. Phần D — Bảng tồn kho (in PDF)

- Route `src/app/api/reports/stock/pdf/route.tsx` (manager) nhận query `location` (uuid, mặc định tất cả).
- Nội dung: tồn hiện tại theo `stock_balances` từng kho, chỉ mục > 0; composite tính từ linh kiện của kho đó; cột `STT | Tên hàng (kèm biến thể) | ĐVT | Tồn kho`; nhóm theo kho khi in "Tất cả" (tên kho làm dòng nhóm), hoặc ghi rõ kho khi chọn 1 kho.
- Khung chuẩn: tiêu đề "BẢNG TỒN KHO", dòng ngày, không chữ ký; cuối ghi số mặt hàng.
- Nút "In bảng tồn" trên màn `/reports` (kèm chọn kho) — thêm PDF cùng cụm CSV hiện có.
- Triển khai: bảng tồn in theo 1 kho bắt buộc (tham số location); chưa hỗ trợ in gộp tất cả kho.

## 7. Phần E — In phiếu kiểm kê
- Nút "In" trên màn Kiểm kê + route `/api/stocktake/[id]/pdf` (manager).
- Config chuẩn: "PHIẾU KIỂM KÊ"; field: Kho, Ngày kiểm; cột theo stocktake items: `Tên hàng (biến thể) | ĐVT | Tồn sổ sách | Tồn thực tế | Chênh lệch`; signers theo A4.

## 8. Mặc định & điểm mở (xác nhận khi duyệt spec)
1. Ô "Thông tin xe vận chuyển": 2 dòng **Biển số xe** và **Người vận chuyển** (đã đồng ý).
2. Phiếu xuất nội bộ bỏ cột giá (đã đồng ý); chữ ký nội bộ bỏ ô "Vận chuyển".
3. Mã phiếu xuất: prefix **PXK** (như GRN/REQ). Nếu muốn phân biệt bán/nội bộ bằng mã thì báo — mặc định cùng dãy PXK.
4. Logo: chờ anh gửi file (`public/brand/logo.png`); trước khi có file in không logo.
5. Giá mặc định khi thêm dòng xuất = giá đang lưu của hàng (`variants.price`), sửa được.
6. Số điện thoại in dạng `0988 365 238 – 0963 077 879` (tách nhóm).

## 9. An toàn DB & vận hành
- Migration **chỉ additive**: bảng mới, ALTER TYPE thêm enum value, sequence mới — không đụng bảng dữ liệu cũ.
- Dev (3001) và prod (3000) đang dùng chung DB local; chạy migration theo quy trình có trong `BUILD_GUIDE.md`/`DEPLOYMENT.md`, kiểm tra `scripts/verify-*` trước khi chạy trên web chính; không chạy migration phá dữ liệu.
- RLS: mọi bảng mới `to authenticated` với chính sách read/write giống suppliers/receipts; mọi biến động kho chỉ qua RPC definer (không cho INSERT/UPDATE trực tiếp `stock_balances`/`stock_movements`).

## 10. Kiểm thử & nghiệm thu
- Unit (vitest): util đọc số tiền bằng chữ (các mốc: 0, lẻ nghìn/triệu/tỷ, số 0 ở giữa như 1.000.005, giới hạn); giữ `stock.test.ts`…
- Script flow `scripts/verify-issue-flow.ts` (kiểu các `verify-*.ts`): tạo khách → tạo phiếu xuất (draft) → post → kiểm tồn giảm đúng + `stock_movements` có `issue_out` + audit; thiếu tồn → báo lỗi không chốt; cancel draft OK; cancel posted bị chặn; composite bung linh kiện.
- PDF smoke: mở rộng `scripts/verify-pdf-font.tsx` sinh `pxk-sample.pdf` (cả 2 kiểu đích), `stock-sheet-sample.pdf`, cập nhật `grn/req` mẫu — mở xem bằng tay.
- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build` sạch.
- Nghiệm thu hình thức: in thử từng loại trên web dev, so bố cục với mẫu giấy.

## 11. Thứ tự triển khai (đề xuất)
1. Engine mẫu chuẩn (`slip.tsx` + `standards.ts`) + đổi 5 route hiện có + smoke PDF → nghiệm thu hình thức trước.
2. Util tiền bằng chữ (+ test).
3. Migration DB (customers, issues, enum, seq, RLS) + typegen.
4. RPC + `verify-issue-flow.ts`.
5. UI module xuất (nav, list, form, detail, actions, admin customers).
6. PDF xuất kho + nút in.
7. Bảng tồn PDF + nút In trên reports.
8. In phiếu kiểm kê.
9. Chạy đủ kiểm tra + deploy theo quy trình repo.
