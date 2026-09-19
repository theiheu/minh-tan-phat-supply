# Thiết kế thông báo email theo vai trò người dùng

**Mã tài liệu:** `SPEC-2026-09-19-ROLE-EMAIL`  
**Ngày:** 2026-09-19  
**Trạng thái:** Approved  
**Phương án được duyệt:** B — Registry chính sách email tập trung theo sự kiện và vai trò

## 1. Bối cảnh

MTP-ERP đã có `notifyUsers()`, gửi thông báo trong ứng dụng và email SMTP tới danh sách tài khoản được truyền vào. Tuy nhiên, quy tắc chọn người nhận hiện nằm rải rác trong từng `actions.ts`, mẫu email chưa phân biệt mục đích theo vai trò, và helper `getManagerIds()` vẫn truy vấn vai trò `manager` không còn thuộc mô hình vai trò chuẩn.

Hệ thống có bảy vai trò chuẩn: `superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester`, `driver`.

## 2. Mục tiêu và nguyên tắc

### 2.1 Mục tiêu

- Gửi email tức thời sau sự kiện nghiệp vụ.
- Chỉ gửi cho người cần hành động hoặc chịu ảnh hưởng trực tiếp.
- Cá nhân hóa nội dung, dữ liệu và CTA theo mục đích nhận.
- Có một nguồn sự thật duy nhất cho việc định tuyến email.
- Bảo toàn thông báo trong ứng dụng và không làm giao dịch chính thất bại khi SMTP lỗi.

### 2.2 Nguyên tắc bắt buộc

1. Loại người thực hiện (`actorId`) khỏi danh sách email, trừ sự kiện được định nghĩa rõ là biên nhận bắt buộc.
2. Khử trùng lặp khi một tài khoản thỏa nhiều điều kiện.
3. Chỉ gửi tới hồ sơ đang hoạt động, có email thật và không kết thúc bằng `@mtp.local`.
4. Kiểm tra vai trò tại thời điểm gửi; không suy diễn quyền từ helper phân quyền UI.
5. `superuser` không tự động kế thừa email nghiệp vụ.
6. Dữ liệu tài chính chỉ xuất hiện trong email dành cho nhóm tài chính.
7. Lỗi SMTP được ghi nhận nhưng không rollback nghiệp vụ chính.
8. Thông báo trong ứng dụng và email là hai chính sách kênh riêng; thay đổi định tuyến email không được vô tình làm mất thông báo trong ứng dụng.

## 3. Quyết định kiến trúc

### 3.1 Registry chính sách tập trung

Các phân hệ phát một sự kiện chuẩn thay vì tự xây danh sách người nhận email:

```ts
notifyBusinessEvent({
  event: "requisition.approved",
  actorId,
  subject: { type: "requisition", id: requisitionId },
  participants: { requesterId },
  payload: { code, zoneName },
});
```

Registry trung tâm sở hữu:

- event key và schema payload;
- điều kiện vai trò/người tham gia;
- quy tắc loại `actorId`;
- template kind và CTA;
- các trường dữ liệu được phép hiển thị;
- link đích;
- chính sách email và in-app độc lập.

Các resolver chỉ trả tài khoản nhận; renderer không tự quyết định người nhận. Các feature action không được chứa danh sách vai trò email riêng sau khi migration hoàn tất.

### 3.2 Các phương án đã loại

- **Phân tán theo feature:** ít thay đổi ban đầu nhưng tiếp tục tạo nhiều nguồn sự thật và khó kiểm toán.
- **Database trigger/hàng đợi sự kiện:** bền vững hơn cho nhiều producer nhưng vượt nhu cầu hiện tại, tăng vận hành và làm phức tạp dữ liệu ngữ cảnh. Có thể xem xét như bước mở rộng sau, không thuộc scope này.

## 4. Ma trận vai trò

| Vai trò | Nhận email | Không nhận |
|---|---|---|
| `superuser` — Quản trị hệ thống | Quản trị tài khoản, cấu hình email, lỗi gửi hoặc sự cố hệ thống cần can thiệp | Nghiệp vụ kho thường ngày |
| `owner` — Chủ trại | Nhập mua hoàn tất, xuất bán, thanh lý hoàn tất, kiểm kê có chênh lệch giá trị, hủy/đảo giao dịch có tác động tài chính | Yêu cầu cấp phát, chuyển kho, sửa chữa và vận hành thông thường |
| `accountant` — Kế toán | Giao dịch tài chính đã hoàn tất: nhập mua, xuất bán, thanh lý, kiểm kê; hủy/đảo giao dịch tài chính | Nháp, chờ duyệt và trạng thái vận hành trung gian |
| `warehouse` — Quản kho | Sự kiện cần thao tác kho: yêu cầu đã duyệt, hàng cần nhập/xuất, chuyển kho, kiểm kê, thu hồi dụng cụ, tiếp nhận hàng hỏng, đưa đi sửa, thanh lý đã duyệt | Xác nhận cho hành động do chính mình vừa thực hiện |
| `technician` — Kỹ thuật | Báo hỏng mới, yêu cầu đánh giá, đưa đi sửa, kết quả sửa chữa, yêu cầu nghiệm thu | Nhập/xuất kho thông thường |
| `requester` — Người yêu cầu | Phiếu được duyệt, từ chối, hủy, đã cấp/sẵn sàng nhận; nhắc dụng cụ | Xác nhận ngay sau khi tự tạo/gửi phiếu |
| `driver` — Tài xế | Cấp nhiên liệu gắn trực tiếp với tài khoản; giao dịch đó bị hủy/điều chỉnh | Giao dịch của tài xế khác và nhập nhiên liệu |

## 5. Ma trận sự kiện

### 5.1 Yêu cầu vật tư

| Sự kiện | Người nhận email | Mục đích |
|---|---|---|
| `requisition.approved` | Người yêu cầu; Quản kho | Báo kết quả cho requester và tạo việc chuẩn bị hàng cho warehouse |
| `requisition.rejected` | Người yêu cầu | Báo kết quả và lý do |
| `requisition.fulfilled` | Người yêu cầu | Báo đã cấp/sẵn sàng nhận |
| `requisition.cancelled` | Người yêu cầu; Quản kho nếu còn việc đang chờ | Dừng hành động |
| `requisition.received` | Không gửi email mặc định | Tránh email thông tin ít giá trị |

Không gửi email xác nhận khi requester tự tạo hoặc gửi phiếu.

### 5.2 Nhập, xuất và tài chính

| Sự kiện | Người nhận email |
|---|---|
| `receipt.posted` | Kế toán; Chủ trại |
| `receipt.cancelled_or_reversed` | Kế toán; Chủ trại |
| `issue.sale_posted` | Kế toán; Chủ trại |
| `issue.internal_action_required` | Quản kho |
| `liquidation.approved` | Quản kho |
| `liquidation.completed` | Kế toán; Chủ trại; người lập nếu cần biết kết quả |
| `stocktake.posted_with_variance` | Kế toán; Chủ trại |
| `stocktake.posted_without_variance` | Không gửi Chủ trại; chỉ gửi vận hành khi có công việc tiếp theo |
| Các giao dịch tài chính bị hủy/đảo | Kế toán; Chủ trại |

### 5.3 Hàng hỏng và sửa chữa

| Sự kiện | Người nhận email |
|---|---|
| `defect.created` | Kỹ thuật |
| `defect.resolution_selected` | Quản kho nếu cần đổi, chuyển hoặc xuất hàng |
| `repair.sent` | Kỹ thuật |
| `repair.ready_for_acceptance` | Kỹ thuật |
| `repair.accepted_and_returned` | Người báo hỏng nếu kết quả ảnh hưởng trực tiếp |
| `defect.sent_to_liquidation` | Quản kho; Kế toán/Chủ trại chỉ nhận khi thanh lý hoàn tất |

### 5.4 Mượn–trả dụng cụ

| Sự kiện | Người nhận email |
|---|---|
| `tool.borrowed` | Người mượn |
| `tool.due_soon` | Người mượn — một lần khi còn khoảng 24 giờ |
| `tool.overdue_started` | Người mượn; Quản kho — một lần khi bắt đầu quá hạn |
| `tool.returned` hoặc `tool.cancelled` | Người mượn; không gửi Quản kho nếu họ là actor |

Tác vụ lịch phải lưu dấu idempotency theo `borrowing_id + reminder_type`. Phiếu đã trả hoặc hủy không được nhắc.

### 5.5 Nhiên liệu

| Sự kiện | Người nhận email |
|---|---|
| `fuel.receipt_completed` | Kế toán; Chủ trại |
| `fuel.receipt_cancelled` | Kế toán; Chủ trại |
| `fuel.dispensed` | Tài xế được chọn |
| `fuel.dispense_cancelled_or_adjusted` | Tài xế liên quan |

Email tài xế hiển thị xe, loại nhiên liệu, số lượng, ODO/giờ máy, khu vực, thời điểm và người cấp; không hiển thị giá mua hay dữ liệu tài chính.

## 6. Liên kết tài xế và tương thích dữ liệu

Thêm `fuel_dispenses.driver_id uuid null references profiles(id)`; giữ `driver_name text null` làm snapshot lịch sử.

Quy tắc:

- UI chọn một hồ sơ đang hoạt động có vai trò `driver`.
- Khi tạo phiếu, server/RPC xác thực vai trò và sao chép tên hiện tại sang `driver_name`.
- Email định tuyến bằng `driver_id`, không dò theo tên.
- Dữ liệu cũ với `driver_id = null` vẫn đọc và in bình thường.
- Không tự động backfill theo `driver_name` vì có nguy cơ gán sai người.
- Hủy kích hoạt hoặc thay đổi tài khoản không làm thay đổi snapshot `driver_name` trên chứng từ cũ.

### Data Destruction Guard

- **Target class:** schema/persistent-state additive migration.
- **Thao tác được phép trong thiết kế:** thêm cột nullable, foreign key và cập nhật contract/RPC.
- **Thao tác bị cấm trong scope:** xóa `driver_name`, đổi dữ liệu lịch sử hoặc backfill suy đoán theo tên.
- **Kết luận:** không có xóa dữ liệu; mọi thay đổi hủy dữ liệu trong tương lai cần xác nhận riêng.

## 7. Hợp đồng template

### 7.1 Email cần hành động

- Nhãn: **CẦN XỬ LÝ**.
- Nêu việc cần làm và hạn xử lý trước phần chi tiết.
- CTA: **Mở phiếu để xử lý**.

### 7.2 Email thông báo kết quả

- Nhãn theo trạng thái: **ĐÃ HOÀN TẤT**, **BỊ TỪ CHỐI**, **ĐÃ HỦY**.
- Nêu kết quả trước, chi tiết sau.
- CTA: **Xem chi tiết**.

### 7.3 Email tài chính

- Hiển thị mã chứng từ, đối tác, tổng giá trị, trạng thái hóa đơn nếu có.
- Chỉ renderer dành cho `owner` và `accountant` được nhận trường tài chính.
- CTA: **Kiểm tra chứng từ**.

### 7.4 Email tài xế

- Nội dung ngắn, ưu tiên di động.
- Xe, nhiên liệu, số lượng và ODO/giờ máy nằm ở đầu.
- CTA: **Xem phiếu cấp nhiên liệu**.

## 8. Bảo mật, idempotency và quan sát

- Payload gửi renderer phải được lọc theo template kind, không chỉ ẩn bằng CSS.
- Ghi log tối thiểu: event key, subject ID/type, recipient ID, template kind, thời điểm, kết quả, mã lỗi; không ghi SMTP credential.
- Mỗi email sự kiện có idempotency key ổn định để retry không gửi trùng.
- Các resolver phải trả lý do loại người nhận trong chế độ test/diagnostic.
- Link trong email phải trỏ tới route người nhận có quyền mở; định tuyến email không thay thế RLS/authorization.

## 9. Anti-entropy và migration

### Anti-Entropy Declaration

- **Deletion class:** code-retirement.
- **Old responsibility:** feature action tự quyết định vai trò nhận email; `getManagerIds()` làm chủ danh sách nghiệp vụ bằng vai trò `manager` lỗi thời.
- **New canonical owner:** registry chính sách email theo event.
- **Preserved behavior:** in-app notification, SMTP best-effort, email cá nhân hóa, chứng từ cũ.
- **Retired behavior:** danh sách vai trò email rải rác và superuser mặc định nhận nghiệp vụ.
- **Persistent-state risk:** không xóa dữ liệu; chỉ migration thêm cột nullable.

### Retirement Decision

- **Path:** delete-first cho trách nhiệm định tuyến email cũ sau khi từng event đã chuyển sang registry và test tương ứng đã đạt.
- Không giữ hai policy owner hoạt động song song như fallback lâu dài.
- Có thể giữ adapter tạm trong cùng lát triển khai, nhưng adapter chỉ chuyển event sang registry và phải có điểm xóa rõ ràng trong plan.

## 10. Phạm vi và phi mục tiêu

### Trong phạm vi

- Registry event/policy tập trung.
- Resolver người nhận theo vai trò và người tham gia.
- Template theo bốn mục đích.
- Migration `driver_id` và cập nhật form/RPC liên quan.
- Scheduler nhắc hạn dụng cụ với hai mốc.
- Log/idempotency email.
- Migration các lời gọi email hiện có và cập nhật tài liệu email.

### Ngoài phạm vi

- Email tổng hợp hằng ngày.
- Giao diện cho người dùng tự bật/tắt loại email.
- Push notification/SMS/Zalo.
- Thay SMTP bằng nhà cung cấp hàng đợi email bên ngoài.
- Backfill tài xế cũ theo tên.
- Xóa dữ liệu hay cột lịch sử.

## 11. Tiêu chí nghiệm thu

1. Mỗi event có đúng người nhận theo ma trận và không có vai trò ngoài policy.
2. `superuser` không nhận email kho thông thường.
3. Actor không nhận email cho chính thao tác, trừ event quy định biên nhận.
4. Email tài chính không gửi hoặc render dữ liệu tài chính cho vai trò khác.
5. Tài xế chỉ nhận giao dịch có `driver_id` của mình.
6. Chứng từ cũ không có `driver_id` vẫn đọc/in được.
7. Nhắc dụng cụ gửi đúng hai mốc và không lặp khi scheduler retry.
8. SMTP lỗi không rollback giao dịch chính.
9. In-app notification giữ đúng hành vi đã xác định độc lập với email.
10. Registry, resolver, renderer và các event quan trọng có unit/integration test; có negative test cho gửi sai vai trò.
11. Không còn feature action làm chủ danh sách vai trò nhận email sau migration.

## 12. Kế hoạch xác minh cấp thiết kế

- **Main path:** kiểm thử bảng event × role/participant × actor và snapshot HTML theo template kind.
- **Lingering reference:** tìm và loại các truy vấn `manager`/`superuser` dùng làm policy email trong feature actions.
- **Negative:** chứng minh superuser không nhận nghiệp vụ, actor không tự nhận, tài xế khác không nhận, requester không thấy dữ liệu tài chính.
- **Boundary:** migration nullable tương thích dữ liệu cũ; RLS và quyền mở link không thay đổi; SMTP failure vẫn best-effort.

## 13. Tài liệu nền

- `CONTEXT.md` — thuật ngữ nghiệp vụ và ràng buộc kiến trúc.
- `docs/DOMAIN_AND_EMAIL_SETUP.md` — cấu hình SMTP và ma trận email cũ cần được cập nhật khi triển khai.
- `docs/superpowers/specs/2026-09-08-fuel-management-design.md` — schema nhiên liệu hiện dùng `driver_name` dạng text.
- `docs/aegis/specs/2026-09-20-role-tailored-dashboard-design.md` — trách nhiệm của bảy vai trò trong trải nghiệm ứng dụng.
