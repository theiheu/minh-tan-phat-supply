# Hướng dẫn vận hành: Tác vụ tự động quét nhắc hạn dụng cụ (Tool Reminders Scheduler)

**Endpoint:** `POST /api/internal/tool-reminders`  
**Bảo mật:** `Authorization: Bearer <INTERNAL_CRON_SECRET>`  
**Cơ chế Idempotency:** Lưu vết nguyên tử qua RPC `claim_tool_reminders` và bảng `tool_reminder_claims`.

---

## 1. Cơ chế hoạt động

Tác vụ thực hiện hai nhiệm vụ nhắc hạn cho các phiếu mượn dụng cụ có trạng thái `borrowed`:

1. **Sắp đến hạn (24 giờ):**
   - Điều kiện: `expected_return_date` nằm trong khoảng từ `hiện tại` đến `hiện tại + 24h`.
   - Người nhận: Người mượn (`borrower_id`).
   - Mẫu email: Action Email với nhãn `[Nhắc hạn] Dụng cụ sắp đến hạn hoàn trả (24h)`.
   - Chỉ gửi đúng 1 lần cho mỗi phiếu.

2. **Bắt đầu quá hạn:**
   - Điều kiện: `expected_return_date < hiện tại`.
   - Người nhận: Người mượn (`borrower_id`) và Thủ kho (`warehouse`).
   - Mẫu email: Action Email với nhãn `[Cảnh báo] Dụng cụ đã quá hạn hoàn trả`.
   - Chỉ gửi đúng 1 lần khi bắt đầu quá hạn.

---

## 2. Thiết lập Cron / Systemd Timer trên Server Host

### Lựa chọn A: Crontab (Khuyến nghị chạy mỗi 15 hoặc 30 phút)

Mở crontab trên máy chủ:
```bash
crontab -e
```

Thêm dòng sau (thay thế token bí mật tương ứng):
```cron
*/15 * * * * curl -s -X POST http://127.0.0.1:3000/api/internal/tool-reminders -H "Authorization: Bearer YOUR_INTERNAL_CRON_SECRET" > /dev/null 2>&1
```

### Lựa chọn B: Systemd Timer

Tạo file `/etc/systemd/system/mtp-tool-reminders.service`:
```ini
[Unit]
Description=MTP ERP Tool Reminders Trigger
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -s -X POST http://127.0.0.1:3000/api/internal/tool-reminders -H "Authorization: Bearer YOUR_INTERNAL_CRON_SECRET"
```

Tạo file `/etc/systemd/system/mtp-tool-reminders.timer`:
```ini
[Unit]
Description=Run MTP Tool Reminders every 15 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min

[Install]
WantedBy=timers.target
```

Kích hoạt timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mtp-tool-reminders.timer
```

---

## 3. Kiểm tra thủ công và Giám sát

Gửi request kích hoạt thủ công từ máy chủ:
```bash
curl -i -X POST http://127.0.0.1:3000/api/internal/tool-reminders \
  -H "Authorization: Bearer YOUR_INTERNAL_CRON_SECRET"
```

Kết quả mẫu trả về khi có phiếu cần nhắc:
```json
{
  "ok": true,
  "result": {
    "claimedCount": 2,
    "dueSoonCount": 1,
    "overdueCount": 1,
    "errors": []
  }
}
```

Kiểm tra nhật ký gửi email trong cơ sở dữ liệu:
```sql
SELECT * FROM public.email_delivery_attempts
WHERE event_key IN ('tool.due_soon', 'tool.overdue_started')
ORDER BY created_at DESC LIMIT 20;
```
