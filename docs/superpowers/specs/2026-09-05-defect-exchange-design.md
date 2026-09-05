# Đổi vật tư hỏng lấy vật tư mới — yêu cầu kèm chi tiết + hình ảnh bắt buộc

- Ngày: 2026-09-05
- Trạng thái: Thiết kế đã được người dùng duyệt (2026-09-05); chờ rà soát spec
- Phạm vi: features `defects`, `requisitions`, storage bucket mới `defect-images`

## 1. Bối cảnh & mục tiêu

Người dùng (người yêu cầu ở trại) gặp vật tư hỏng và muốn **đổi vật tư hỏng lấy vật tư mới**. Yêu cầu bắt buộc: người yêu cầu phải gửi **chi tiết thông tin + hình ảnh vật tư hỏng trước khi được đổi vật tư mới** — manager đối chiếu chứng cứ rồi mới duyệt cấp mới.

Các quyết định đã chốt với người dùng:
1. Xây trên **phiếu hỏng HONG sẵn có** (1 nguồn sự thật) — không tạo luồng/kho riêng.
2. **Ảnh + chi tiết bắt buộc ngay khi lập HONG**: mỗi dòng cần ≥ 1 ảnh + mô tả hỏng + kiểu hỏng + mức độ mới lưu được. Phiếu đầy đủ mới được tạo yêu cầu đổi mới.
3. Yêu cầu đổi mới = phiếu yêu cầu loại **Đổi mới (replacement)** liên kết phiếu HONG, **đứng tên người lập HONG** (manager bấm giúp cũng đứng tên người lập HONG).
4. Sau khi cấp vật tư mới, vật tư hỏng **giữ nguyên ở Kho hỏng** — manager tự quyết tiếp (đưa đi sửa / thanh lý), không tự xoá stock.

## 2. Hiện trạng liên quan (đã rà)

- `defect_note_items`: đã có cột `damage_detail`, `damage_type`, `severity`, `images text[] not null default '{}'`. `record_defect` (RPC) không yêu cầu ảnh/kiểu/mức độ — chỉ bắt buộc `damage_detail` ở tầng schema client.
- **UI lập phiếu HONG chưa có upload ảnh** (form ghi `images: []` cố định).
- **Chưa có bucket `defect-images`** (chỉ có `product-images` trong migration storage).
- Danh sách HONG có link "Đổi mới" **mở thẳng** `/requisitions/new` cho mọi phiếu — không kiểm tra chủ sở hữu/trạng thái/đủ ảnh, không điền sẵn.
- Phiếu yêu cầu "Đổi mới" đã có: form yêu cầu chọn phiếu hỏng liên quan; RPC `create_requisition` nhận `p_type='replacement'`, `p_linked_defect_id`, `p_requester_id` (manager có thể tạo dùm).
- Màn chi tiết phiếu yêu cầu hiện **không hiển thị** phiếu hỏng liên quan/ảnh — manager duyệt không xem được chứng cứ.
- Trạng thái HONG: `staging | in_repair | returned | liquidated | cancelled`.

## 3. Luồng nghiệp vụ

1. **Lập HONG** (người giữ vật tư, Kho nguồn): thêm dòng vật tư hỏng → nhập bắt buộc *Mô tả hỏng, Kiểu hỏng, Mức độ*, upload **≥ 1 ảnh/dòng**. Thiếu → chặn lưu. Stock chính → Kho hỏng (như cũ).
2. HONG ở `staging`, do chính người dùng lập (hoặc manager xem): nút **"Tạo yêu cầu đổi mới"** → tạo phiếu yêu cầu loại Đổi mới:
   - requester = `reported_by` của HONG; items copy từ các dòng HONG (variant + quantity); `linked_defect_id` = HONG; `purpose` mặc định "Thay thế vật tư hỏng <code>"; zone = zone của người yêu cầu (profile.zone_id).
   - Gate: phiếu `staging`, từng dòng có ≥ 1 ảnh + đủ thông tin; **chưa tồn tại** phiếu yêu cầu Đổi mới liên kết HONG này ở trạng thái sống: `draft | pending | approved | issued | received`. Đã `cancelled`/`rejected` thì tạo lại được.
3. Phiếu Đổi mới chạy luồng phiếu yêu cầu thường: manager duyệt → cấp phát → người lập HONG nhận vật tư mới.
4. Khi manager xem/duyệt phiếu yêu cầu loại Đổi mới: khối **"Vật tư hỏng liên quan"** hiển thị mã HONG + từng dòng (tên, biến thể, số lượng, mô tả, kiểu, mức độ) + **ảnh** → đối chiếu trước khi duyệt.
5. HONG sau khi có yêu cầu đổi mới: giữ nguyên trạng thái/quy trình hiện tại (manager tự xử lý sửa/thanh lý).

## 4. Thay đổi chi tiết

### 4.1 DB — migration mới `0030_defect_images.sql`
- Tạo bucket storage **`defect-images`** public-read, authenticated-write (mô phỏng policy `product-images` trong `0024_storage.sql`).
- (Không đổi bảng; không đổi RPC. Bắt buộc ảnh/kiểu/mức độ xử lý ở tầng schema + action, không ràng DB cứng để không phá dữ liệu cũ.)

### 4.2 Lập phiếu HONG — upload ảnh + bắt buộc đủ thông tin
- `src/features/defects/schema.ts`: `damageDetail`, `damageType`, `severity` bắt buộc; `images` tối thiểu 1 URL.
- `src/features/defects/components/defect-form.tsx`: thêm UI upload ảnh **từng dòng** (dùng helper `uploadImage` mới ghi vào bucket `defect-images` — pattern theo `src/features/products/upload.ts`); xoá `images: []` cứng; hiện ảnh + nút xoá; disable nút Tạo khi dòng chưa đủ.
- `src/features/defects/actions.ts` (action tạo HONG): validate theo schema mới trước khi gọi RPC.

### 4.3 Tạo yêu cầu đổi mới từ HONG
- Thay link "Đổi mới" mở thẳng trong `src/app/(app)/defects/page.tsx` bằng nút/hành động **"Tạo yêu cầu đổi mới"** gọi action server mới.
- Action mới `src/features/defects/actions.ts` (hoặc file riêng): `requireProfile`; kiểm tra HONG tồn tại, `status='staging'`, người gọi là `reported_by` hoặc manager; từng dòng đủ ảnh/thông tin; chưa có yêu cầu Đổi mới active → gọi RPC `create_requisition` với `p_requester_id = reported_by`, `p_zone_id = zone(requester)`, `p_purpose = "Thay thế vật tư hỏng <code>"`, `p_type = replacement`, `p_linked_defect_id`. Trả về id phiếu để redirect.
- Ẩn nút khi đã có yêu cầu active (server gate vẫn kiểm tra).

### 4.4 Manager xem chứng cứ khi duyệt
- `src/app/(app)/requisitions/[id]/page.tsx`: với phiếu loại Đổi mới, load `linked_defect` → `defect_note_items` (kèm variants/products để hiện tên) + ảnh; render khối "Vật tư hỏng liên quan" (ảnh thumb, mở phóng to).
- Nếu có dialog duyệt trong `requisition-actions.tsx`, ảnh/hồ sơ nằm ngay trên trang chi tiết (đã đủ) — không cần đổi dialog.
- PDF phiếu yêu cầu: **không in ảnh** (giữ gọn), chỉ thêm dòng tham chiếu mã HONG nếu dễ (tuỳ chọn, không bắt buộc trong đợt này).

### 4.5 Loại trừ / không làm
- Không cho phép **sửa HONG sau khi lập** (giữ quy tắc hiện tại: staging chỉ huỷ).
- Không tự xoá/thanh lý stock hỏng sau khi cấp mới (đã chốt).
- Không thay đổi luồng sửa chữa (repairs) / thanh lý (liquidations).
- Không đụng `record_defect` SQL (tầng chặn là action/schema; dữ liệu cũ thiếu ảnh vẫn còn nguyên, nhưng không tạo được yêu cầu đổi mới từ dòng thiếu ảnh).

## 5. Kiểm thử

- Script verify (pattern `scripts/verify-*.ts`): lập HONG đủ thông tin → tạo yêu cầu Đổi mới (đúng requester/items/link) → manager duyệt → cấp phát → nhận; test âm: HONG thiếu ảnh không tạo được yêu cầu; người không phải chủ + không phải manager bị chặn; tạo lần 2 bị chặn do đã có yêu cầu active.
- `bunx supabase db reset` (migration 0030) + `gen types`.
- `bun run lint` · `typecheck` · `test`.

## 6. Câu hỏi mở (đặt mặc định, người dùng có thể đổi khi rà spec)
- Số ảnh tối thiểu/dòng: **1** (≥1).
- Có cho xem ảnh HONG ngay trên trang danh sách HONG không: chỉ khi cần — ảnh xem ở màn chi tiết phiếu yêu cầu (manager duyệt) và PDF HONG nếu đã có (không thêm màn mới trong đợt này).
- Tên nút giữ nguyên "Tạo yêu cầu đổi mới" (khớp BUILD_GUIDE).
