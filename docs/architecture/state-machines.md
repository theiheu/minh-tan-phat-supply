# 🔄 VÒNG ĐỜI CHỨNG TỪ & MÁY TRẠNG THÁI (STATE MACHINES & DOCUMENT LIFECYCLES)

> Tài liệu đặc tả các máy trạng thái (State Machines), điều kiện chuyển đổi (State Transitions), vai trò có thẩm quyền và quy tắc khóa dữ liệu (Immutability Rules) của toàn bộ các loại chứng từ trong hệ thống **Minh Tân Phát Supply**.

---

## 1. PHIẾU YÊU CẦU VẬT TƯ (REQUISITIONS STATE MACHINE)

Phiếu xin cấp vật tư trang trại trải qua quy trình kiểm soát 2 cấp nghiêm ngặt nhằm đảm bảo đúng mục đích sử dụng và có sự xác nhận 2 chiều khi giao nhận hàng:

```mermaid
stateDiagram-v2
    [*] --> draft: Tạo nháp (Requester/Technician)
    draft --> pending: Gửi duyệt (submit_requisition)
    draft --> cancelled: Hủy phiếu nháp
    pending --> approved: Kỹ thuật / Quản kho duyệt (approve_requisition)
    pending --> rejected: Kỹ thuật / Quản kho từ chối (reject_requisition)
    pending --> cancelled: Người tạo hủy phiếu
    approved --> issued: Quản kho xuất kho & Giao hàng (fulfill_requisition)
    issued --> received: Người nhận bấm Xác nhận đã nhận đủ (receive_requisition)
    received --> returned: Hoàn trả vật tư thừa về kho (return_requisition_items)
    received --> [*]: Hoàn tất vòng đời
    returned --> [*]: Đã nhập lại kho phần thừa
    rejected --> [*]
    cancelled --> [*]
```

### Chi tiết các trạng thái Requisition:
| Trạng thái | Tên tiếng Việt | Quyền thao tác | Hành động hệ thống |
|---|---|---|---|
| `draft` | **Bản nháp** | `requester`, `technician` | Chưa trừ kho. Người tạo có thể tự do thêm/bớt vật tư trong giỏ hàng. |
| `pending` | **Chờ phê duyệt** | `technician`, `warehouse`, `owner` | Đã khóa chỉnh sửa nội dung. Đang chờ Kỹ thuật trưởng hoặc Quản lý khu phê duyệt. |
| `approved` | **Đã phê duyệt** | `warehouse` | Đã chấp thuận cấp phát. Phiếu sẵn sàng để Quản kho xuất hàng (hoặc tự động fulfill khi nhập kho mới). |
| `issued` | **Đã xuất hàng** | `warehouse` (thực hiện) | Tồn kho vật lý trong hệ thống đã bị trừ. Hàng đang trên đường giao về trại. |
| `received` | **Đã nhận đủ** | `requester` (xác nhận) | Người nhận bấm xác nhận 2 chiều trên app. Phiếu đóng lại hoàn tất. |
| `rejected` | **Bị từ chối** | `technician`, `warehouse` | Ghi nhận lý do từ chối (ví dụ: xin vượt định mức), không xuất hàng. |
| `cancelled` | **Đã hủy** | Người tạo phiếu | Người tạo chủ động hủy khi không còn nhu cầu. |

---

## 2. PHIẾU NHẬP KHO NHÀ CUNG CẤP (RECEIPTS STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> draft: Tạo phiếu nhập & Chụp ảnh hóa đơn (create_receipt)
    draft --> posted: Duyệt nhập kho & Tự động cấp phát (post_receipt)
    draft --> cancelled: Hủy phiếu nhập (cancel_receipt)
    posted --> cancelled: Hoàn tác nhập kho - Reversal Movement (revert_receipt)
    posted --> [*]: Tồn kho đã cộng & Lưu sổ cái
    cancelled --> [*]
```

### Quy tắc tự động cấp phát khi nhập kho (Auto-Fulfill):
1. Khi Quản kho bấm **Hoàn tất nhập kho (`post_receipt`)**, tồn kho sẽ được cộng ngay lập tức.
2. Hệ thống tự động tìm các Phiếu yêu cầu **ĐÃ ĐƯỢC PHÊ DUYỆT (`approved`)** theo thứ tự thời gian tạo tăng dần (FIFO).
3. Tự động xuất kho (`fulfill_requisition`) cho các phiếu này và lưu vết kết quả bền vững vào bảng audit và `linked_requisition_ids`.
4. *Lưu ý quan trọng:* Các phiếu đang ở trạng thái `pending` (chưa duyệt) sẽ **không** bị tự động xuất hàng để đảm bảo nguyên tắc quản trị.

---

## 3. PHIẾU XUẤT KHO TRỰC TIẾP (ISSUES STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> draft: Tạo phiếu xuất nội bộ / Bán hàng (create_issue)
    draft --> posted: Xác nhận xuất kho & Trừ tồn ngay (post_issue)
    draft --> cancelled: Hủy phiếu nháp
    posted --> cancelled: Hoàn tác xuất kho - Reversal Movement (revert_issue)
    posted --> [*]: Đã trừ tồn & Ghi nhận chi phí dãy trại
    cancelled --> [*]
```

---

## 4. QUY TRÌNH BÁO HỎNG & ĐỔI 1-1 CẤP TỐC (DEFECTS & EXCHANGES)

```mermaid
stateDiagram-v2
    [*] --> Defect_Staging: Báo hỏng tại trại kèm >= 1 ảnh (record_defect)
    Defect_Staging --> Quick_Exchange: Chọn Đổi 1-1 Cấp Tốc (create_exchange)
    Quick_Exchange --> Exchange_Approved: Duyệt đổi (approve_exchange)
    Exchange_Approved --> Exchange_Issued: Xuất hàng mới từ Kho Tổng & nạp đồ hỏng (issue_exchange)
    Exchange_Issued --> Exchange_Received: Thợ nhận hàng mang đi lắp (receive_exchange)
    Defect_Staging --> Repair_Staging: Gom đi sửa chữa (send_to_repair)
    Defect_Staging --> Liquidation_Staging: Chuyển thanh lý ve chai (create_liquidation)
```

---

## 5. ĐƠN SỬA CHỮA CƠ ĐIỆN (REPAIR ORDERS STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> in_repair: Gom motor cháy gửi xưởng quấn (send_to_repair)
    in_repair --> returned_to_stock: Nghiệm thu đạt chuẩn ➜ Nhập lại Kho Tổng (complete_repair)
    in_repair --> liquidation: Thợ báo cháy nát không sửa được ➜ Chuyển Thanh lý
    in_repair --> cancelled: Hủy đơn sửa (cancel_repair)
    returned_to_stock --> [*]
    liquidation --> [*]
    cancelled --> [*]
```

---

## 6. MƯỢN TRẢ DỤNG CỤ ĐỒ NGHỀ (TOOL BORROWINGS STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> borrowed: Cho thợ mượn đồ nghề & Hẹn ngày trả (create_tool_borrowing)
    borrowed --> returned: Mang trả đồ nghề còn nguyên vẹn (return_tool_borrowing)
    borrowed --> cancelled: Hủy phiếu mượn nhầm
    returned --> [*]: Hoàn tất thu hồi dụng cụ
    cancelled --> [*]
```
* **Cảnh báo quá hạn (Overdue Alert):** Khi `CURRENT_DATE > due_date` và `status = 'borrowed'`, hệ thống tự động gắn huy hiệu màu đỏ cảnh báo trên màn hình Quản kho và gửi email đôn đốc thu hồi.

---

## 7. TRẠM BỒN DẦU DIESEL & XE CƠ GIỚI (FUEL STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> Fuel_Receipt: Xe bồn Petrolimex vào nhập dầu (create_fuel_receipt)
    Fuel_Receipt --> Bulk_Tank: Tồn kho bồn dầu tăng
    Bulk_Tank --> Dispense: Quét QR xe & Bơm dầu (create_fuel_dispense)
    Dispense --> Verified_Usage: Trừ dầu bồn + Tính L/100km hoặc L/h + Đối soát định mức
```

---

## 8. PHIÊN KIỂM KÊ KHO (STOCKTAKE SESSIONS STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> draft: Mở phiên kiểm kê vị trí kho (create_stocktake)
    draft --> draft: Quét mã QR & Nhập số thực tế (Ghi nhận difference + ảnh)
    draft --> posted: Chủ trại / Kế toán duyệt cân bằng tồn kho (post_stocktake)
    draft --> cancelled: Hủy phiên kiểm kê
    posted --> [*]: Tồn kho tự động điều chỉnh khớp 100% thực tế
    cancelled --> [*]
```
