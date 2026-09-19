# Kế hoạch triển khai thông báo email theo vai trò

**Goal:** Triển khai registry chính sách email tập trung theo sự kiện và vai trò, liên kết tài khoản tài xế với phiếu cấp nhiên liệu, gửi nhắc hạn dụng cụ đúng hai mốc, và loại bỏ quyền sở hữu định tuyến email đang phân tán trong các feature action.

**Architecture:** Feature action phát business event có kiểu; registry trung tâm chọn policy; recipient resolver truy vấn hồ sơ theo vai trò/người tham gia và loại actor; renderer tạo một trong bốn loại email; dispatcher gửi best-effort và ghi delivery/idempotency. In-app notification giữ kênh riêng. Một endpoint nội bộ có secret gọi reminder service; database claim bảo đảm mỗi mốc chỉ được gửi một lần.

**Tech Stack:** Next.js 15 App Router/Server Actions, TypeScript strict, Supabase PostgreSQL 17/RLS/RPC, Nodemailer SMTP, Zod, Vitest/Testing Library, Supabase SQL tests.

**Baseline/Authority Refs:**
- `CONTEXT.md`
- `docs/aegis/specs/2026-09-19-role-based-email-notifications-design.md`
- `docs/DOMAIN_AND_EMAIL_SETUP.md`
- `docs/superpowers/specs/2026-09-08-fuel-management-design.md`
- `docs/aegis/specs/2026-09-20-role-tailored-dashboard-design.md`

**Compatibility Boundary:** Không xóa hoặc backfill suy đoán `driver_name`; `driver_id` nullable; chứng từ cũ tiếp tục đọc/in; SMTP lỗi không rollback nghiệp vụ; in-app notification không phụ thuộc vào quyết định email; RLS/authorization vẫn là lớp bảo vệ khi mở link.

**TDD Route:**
- **Mode:** auto
- **Decision:** strict
- **Strict authority:** recorded auto decision
- **Strict signals:** shared core notification owner, schema migration, producer/consumer contract, dữ liệu tài chính và phân quyền người nhận, scheduler/idempotency.
- **Light eligibility:** không đủ điều kiện vì thay đổi xuyên module và có negative-security behavior.
- **TDD-fit exception:** không có.
- **Test posture:** strict RED test cho registry/resolver/renderer/reminder; SQL contract test cho migration/RPC; regression cho feature producers.
- **Reason:** lỗi định tuyến có thể làm lộ dữ liệu hoặc bỏ sót công việc vận hành.
- **Verification:** focused Vitest + Supabase DB tests + typecheck + lint + full test/build.

## 1. Scope check

### Plan Basis

- **Fact:** bảy vai trò chuẩn nằm trong `src/lib/types.ts`; helper hiện tại `getManagerIds()` truy vấn `manager` và `superuser`.
- **Fact:** các action đang tự truyền `userIds` vào `notifyUsers()`.
- **Fact:** `fuel_dispenses` chỉ có `driver_name`; form nhập tên tự do.
- **Fact:** repo chưa có scheduler/cron owner.
- **Fact:** production chạy Next.js bằng systemd; Docker Compose hiện chỉ khai báo app.
- **Assumption triển khai:** scheduler bên ngoài gọi HTTP endpoint nội bộ theo chu kỳ; database claim giữ idempotency nên tần suất gọi không ảnh hưởng số email.
- **Unknown không chặn coding:** systemd timer hay cron daemon nào sẽ gọi endpoint ở từng môi trường. Plan cung cấp contract và runbook, không tự sửa host production.

### BaselineUsageDraft

- **Required baseline refs:** Design Spec email, `CONTEXT.md`, email setup, fuel schema.
- **Acknowledged before plan refs:** tất cả refs nêu ở header.
- **Cited in plan refs:** registry/event contract, vai trò chuẩn, driver snapshot, SMTP best-effort.
- **Missing refs:** không có authority document cho scheduler host.
- **Decision:** continue; deployment activation của scheduler là bước vận hành có kiểm chứng riêng.

### Requirement Ready Check

- **Goals/scope:** đã duyệt Phương án B.
- **User/scenario:** quyết định riêng cho đủ bảy vai trò, `driver_id`, nhắc trước hạn 24 giờ và quá hạn một lần.
- **Acceptance refs:** Design Spec §11.
- **Open blocker questions:** không có cho implementation; chỉ có bước kích hoạt scheduler ở môi trường đích.
- **Decision:** ready.

### Change Necessity

- **User-visible need:** email phải đến đúng vai trò/người liên quan với nội dung đúng thẩm quyền.
- **No-change option:** sửa tài liệu hoặc tiếp tục cấu hình `userIds` tại từng feature không tạo được canonical policy và không liên kết được tài xế.
- **Minimum change boundary:** notification core, additive DB migration, producer adapters, fuel forms, internal reminder endpoint và docs vận hành.
- **Decision:** code-change.

### Existence Check

- **Proposed surface:** event registry, delivery ledger và reminder endpoint.
- **Reuse candidates:** `src/lib/notifications.ts`, `src/lib/email.ts`, audit logs, existing feature actions.
- **Why insufficient:** helper hiện tại chỉ nhận danh sách user, không có event policy, field-level template filtering hoặc durable idempotency; audit log không có unique delivery key/trạng thái SMTP.
- **Creation proof:** một registry thay nhiều policy owner; delivery ledger là nguồn duy nhất cho retry/idempotency; endpoint là trigger mỏng, reminder service mới là owner.
- **Entropy impact:** xóa `getManagerIds()` và role lists khỏi feature actions sau cutover; không thêm fallback song song.
- **Decision:** add-with-proof.

### Architecture Integrity Lens

- **Invariant:** business action phát sự kiện; registry quyết định email; database/authorization quyết định quyền truy cập dữ liệu.
- **Canonical owner:** `src/features/notifications/server/` cho policy, resolve và dispatch; `src/lib/email.ts` chỉ transport; template renderers ở notification feature.
- **Responsibility overlap:** `notifyUsers()` hiện vừa tạo in-app vừa gửi email và caller tự chọn người nhận; phải tách kênh.
- **Higher-level simplification:** typed business event thay role query rải rác.
- **Retirement:** xóa `getManagerIds()` khi grep chứng minh không còn caller; giữ `notifyUsers()` chỉ cho broadcast/admin nếu đổi tên thành API kênh rõ nghĩa.
- **Verdict:** aligned với Design Spec.

### Plan Pressure Test

- **Owner/contract/retirement:** registry có một owner; event union là contract; old role routing bị loại.
- **Verification:** matrix + negative tests + SQL migration + endpoint auth.
- **Executability:** chia thành lát DB, core, producers, UI, reminders, docs.
- **Pressure result:** proceed.

### Plan-Time Complexity Check

- **Current pressure:** `src/lib/email.ts` khoảng 496 dòng, `src/features/fuel/actions.ts` khoảng 418 dòng; tiếp tục thêm policy vào hai file này sẽ quá tải.
- **Better boundary:** tạo các file nhỏ dưới `src/features/notifications/server/` và `templates/`; action chỉ map domain data sang event.
- **Budget result:** at-risk nếu edit-in-place; within-budget khi tách owner.
- **Recommendation:** add owner files; giữ transport SMTP trong `src/lib/email.ts`.

## 2. File map

### Tạo mới

- `supabase/migrations/0096_role_email_notifications.sql` — `driver_id`, delivery/reminder state, RPC fuel và claim reminders.
- `supabase/tests/role_email_notifications.test.sql` — contract schema, role validation, backward compatibility, reminder claim.
- `src/features/notifications/server/event-types.ts` — event union, participant/payload contracts.
- `src/features/notifications/server/policies.ts` — canonical event policy registry.
- `src/features/notifications/server/resolve-recipients.ts` — resolve role/participant, active/email filters, actor exclusion.
- `src/features/notifications/server/dispatch-business-event.ts` — in-app/email orchestration và delivery ledger.
- `src/features/notifications/server/reminders.ts` — claim và dispatch hai mốc dụng cụ.
- `src/features/notifications/templates/render-role-email.ts` — dispatcher template.
- `src/features/notifications/templates/action-email.ts`
- `src/features/notifications/templates/result-email.ts`
- `src/features/notifications/templates/finance-email.ts`
- `src/features/notifications/templates/driver-email.ts`
- `src/features/notifications/server/*.test.ts` — matrix, dispatcher, reminders.
- `src/features/notifications/templates/*.test.ts` — HTML/field-filter tests.
- `src/app/api/internal/tool-reminders/route.ts` — protected scheduler trigger.
- `src/app/api/internal/tool-reminders/route.test.ts` — auth/response tests.
- `src/features/fuel/components/driver-account-select.tsx` — chọn profile `driver`.
- `src/features/fuel/components/driver-account-select.test.tsx`.
- `docs/operations/email-notification-scheduler.md` — cron/systemd invocation and recovery.

### Sửa

- `src/lib/notifications.ts`, `src/lib/notifications.test.ts` — tách primitive in-app khỏi business email; retire helper cũ.
- `src/lib/email.ts`, `src/lib/email.test.ts` — transport dùng renderer mới mà không sở hữu policy.
- Feature action files: requisitions, receipts, issues, defects, exchanges, repairs, liquidations, stocktake, tools, fuel, transfers.
- Test action tương ứng hiện có hoặc test mới cạnh feature.
- `src/features/fuel/schema.ts`, `actions.ts`, `types.ts`.
- `src/features/fuel/components/fuel-dispense-dialog.tsx`, `fuel-quick-scan.tsx` và trang cha nạp danh sách tài xế.
- `src/types/database.types.ts` — regenerate từ schema sau migration.
- `src/lib/env.ts`, `.env.example`, `docker-compose.app.yml` — `INTERNAL_CRON_SECRET` runtime-only.
- `docs/DOMAIN_AND_EMAIL_SETUP.md`, database schema/reference docs.

## 3. Task batches

## Task 1 — Khóa contract sự kiện và policy matrix

**Files:** tạo `event-types.ts`, `policies.ts`, tests tương ứng.  
**Why:** biến ma trận đã duyệt thành contract compile-time và một nguồn sự thật.  
**Impact/Compatibility:** chưa đổi runtime; cho phép migration producer từng lát nhưng không được giữ hai policy owner sau Task 7.

1. Viết test RED dạng table-driven cho mọi event trong Design Spec. Mỗi case kiểm tra `templateKind`, role targets, participant targets, `excludeActor`, link và financial-field permission.
2. Chạy:
   `pnpm vitest run src/features/notifications/server/policies.test.ts`
   Expected: fail vì module chưa tồn tại.
3. Khai báo `BusinessEventMap`, `BusinessEventKey`, `BusinessEventInput<K>`, `EmailTemplateKind = "action" | "result" | "finance" | "driver"` và policy type không dùng `string` tự do cho event.
4. Implement registry đầy đủ cho các event trong spec; policy không truy vấn DB và không render HTML.
5. Chạy lại focused test; expected pass.
6. Commit coherent slice: `feat(notifications): define typed role email policies`.

## Task 2 — Additive migration cho driver và delivery/reminder state

**Files:** migration 0096, SQL test, generated DB types.  
**Why:** định danh đúng tài xế, durable idempotency và claim nhắc hạn không thể bảo đảm chỉ bằng memory process.  
**Compatibility:** chỉ thêm nullable objects; không xóa/backfill `driver_name`; không chạy destructive SQL.

1. Viết SQL test RED kiểm tra:
   - `fuel_dispenses.driver_id` nullable FK tới `profiles(id)`;
   - RPC create fuel chấp nhận `p_driver_id`, chỉ nhận active role `driver`, snapshot tên vào `driver_name`;
   - gọi không có driver vẫn hợp lệ cho compatibility;
   - bảng `email_delivery_attempts` có unique `idempotency_key` và trạng thái `pending|sent|failed|skipped`;
   - bảng/constraint reminder giữ unique `borrowing_id + reminder_type`;
   - claim function trả due-soon/overdue đúng một lần, bỏ phiếu returned/cancelled.
2. Chạy `pnpm test:db`; expected new SQL test fail trước migration.
3. Viết migration:
   - thêm `driver_id uuid null references public.profiles(id) on delete set null` và index;
   - create delivery-attempt table với recipient/event/subject/template/status/error/timestamps, RLS enabled và không grant client write;
   - create tool-reminder-claim table hoặc các cột dấu riêng; ưu tiên bảng claim để không làm phình `tool_borrowings`;
   - replace canonical `create_fuel_dispense` signature có `p_driver_id uuid default null`; validate active driver và lấy `profiles.name`; ghi cả ID + snapshot;
   - tạo security-definer claim RPC transaction-safe, idempotent, chỉ service role gọi.
4. Không drop overload cũ trong migration này nếu PostgREST consumer hiện hữu cần compatibility; overload cũ chỉ forward vào canonical RPC với `p_driver_id = null` và có retirement note. Không duy trì logic kép.
5. Regenerate `src/types/database.types.ts` bằng workflow Supabase chuẩn của repo; không sửa type rải rác thủ công nếu generator khả dụng.
6. Chạy `pnpm test:db && pnpm typecheck`; expected pass cho slice.
7. Commit: `feat(db): add role email delivery and driver linkage`.

## Task 3 — Recipient resolver và channel primitives

**Files:** resolver/dispatcher mới; sửa `src/lib/notifications.ts`; tests.  
**Why:** tách in-app recipients khỏi email recipients và centralize active/email/role/actor filters.  
**Compatibility:** broadcast admin vẫn có API gửi đích danh; SMTP best-effort giữ nguyên.

1. Viết RED matrix test với hồ sơ gồm đủ 7 vai trò, inactive, null email, `@mtp.local`, actor, duplicate participant và tài xế khác.
2. Chứng minh bằng negative assertions: business event không tự thêm `superuser`; actor bị loại; wrong driver và wrong role bị loại; participant trùng chỉ còn một.
3. Implement resolver nhận policy + participants + actor, truy vấn `id,name,email,role,is_active`, trả `emailRecipients` và diagnostic exclusion reasons.
4. Tách primitive `createInAppNotifications(userIds, message)` khỏi business email. Đổi `notifyUsers` thành wrapper legacy chỉ cho broadcast trong cùng slice hoặc tạo tên `notifyExplicitUsers`; ghi deprecation và caller allowlist.
5. Implement dispatcher:
   - resolve recipients;
   - tạo stable idempotency key từ event + subject + recipient + occurrence key;
   - claim/upsert delivery attempt;
   - render payload đã lọc;
   - gọi `sendEmail`;
   - cập nhật sent/failed và không throw ra business action.
6. Chạy `pnpm vitest run src/features/notifications/server src/lib/notifications.test.ts`.
7. Commit: `feat(notifications): centralize recipient resolution and dispatch`.

## Task 4 — Renderer theo mục đích và khóa dữ liệu tài chính

**Files:** bốn renderer, dispatcher renderer, tests; thu gọn `src/lib/email.ts`.  
**Why:** nội dung/CTA khác nhau và finance data phải bị loại khỏi payload trước khi render cho vai trò khác.  
**Compatibility:** giữ brand, site URL, Vietnamese locale và SMTP transport.

1. Viết RED snapshot/semantic tests cho action, result, finance, driver.
2. Thêm negative test: action/result/driver HTML không chứa `totalAmount`, unit price, invoice fields khi payload nguồn có chúng; driver không thấy giá.
3. Implement shared safe escaping/format helpers và layout MTP-ERP dùng lại; renderer nhận DTO đã allowlist, không nhận raw DB row.
4. Giữ `sendEmail` trong `src/lib/email.ts`; chuyển business HTML ownership sang templates. Giữ adapter `renderNotificationEmailHtml` chỉ cho test email/broadcast nếu còn caller hợp lệ, không dùng cho business event mới.
5. Chạy `pnpm vitest run src/features/notifications/templates src/lib/email.test.ts`.
6. Commit: `feat(email): add role-specific notification templates`.

## Task 5 — Liên kết tài khoản tài xế trong UI và fuel action

**Files:** fuel schema/action/types, hai flow cấp dầu, driver select, tests.  
**Why:** tên tự do không định tuyến email an toàn.  
**Compatibility:** `driverName` trở thành server snapshot; flow cũ không có `driverId` vẫn đọc được nhưng UI mới chọn account.

1. Viết RED schema/action tests: driverId optional UUID; server bỏ qua client-provided snapshot và lấy tên từ DB/RPC; role khác bị từ chối; emitted event chứa đúng driverId.
2. Viết component test: combobox chỉ hiện active driver, chọn account gửi `driverId`, xe có default_driver text cũ không tự đoán ID.
3. Tạo server query lấy `profiles(id,name,username)` role driver active và truyền vào dialog/quick scan từ server owner phù hợp.
4. Thay text input bằng `DriverAccountSelect`; có trạng thái “Không gắn tài khoản” để giữ compatibility cho người nhận dầu không có account, nhưng trường hợp này không gửi email.
5. Gọi RPC mới với `p_driver_id`; đọc metadata có driver_id; phát `fuel.dispensed` và cancellation event. Email chứa xe, loại nhiên liệu, quantity, ODO/unit, zone và dispenser; không có giá.
6. Chạy focused fuel tests, `pnpm typecheck`.
7. Commit: `feat(fuel): link dispense records to driver accounts`.

## Task 6 — Reminder service và endpoint scheduler bảo vệ bằng secret

**Files:** reminders, route, env/config/docs, tests.  
**Why:** hai mốc thời gian cần trigger lặp và durable claim.  
**Compatibility:** không phụ thuộc provider cron; host chỉ cần HTTP scheduler; chưa tự thay đổi systemd/production.

1. Viết RED tests cho service: claim due-soon 24h, overdue once, skip returned/cancelled/no date, retry failed delivery không nhân bản claim.
2. Viết RED route tests: thiếu/sai `Authorization: Bearer <INTERNAL_CRON_SECRET>` trả 401; đúng secret gọi service và trả counts không chứa PII.
3. Implement `processToolReminders(now?)` dùng admin client gọi claim RPC, rồi dispatch `tool.due_soon`/`tool.overdue_started`; warehouse chỉ ở overdue.
4. Implement route `POST /api/internal/tool-reminders`, `dynamic = "force-dynamic"`, validate secret constant-time đủ dùng và không log secret.
5. Thêm `INTERNAL_CRON_SECRET` vào server env, example và runtime Compose; không bake vào image.
6. Viết runbook với systemd timer/cron gọi localhost mỗi 15–30 phút, health/manual invocation, rotate secret, retry, và cách xác nhận delivery ledger. Việc cài timer trên host là bước release riêng cần operator thực hiện.
7. Chạy route/reminder tests và typecheck.
8. Commit: `feat(notifications): schedule idempotent tool reminders`.

## Task 7 — Migrate business-event producers theo từng domain

**Files:** action files và focused tests của các domain.  
**Why:** hoàn tất cutover sang canonical registry và áp đúng ma trận.  
**Impact:** thay người nhận email; in-app recipients phải được khai báo riêng để không mất hành vi hiện tại.

Thực hiện theo các lát độc lập, mỗi lát đều theo RED → GREEN và có focused regression:

1. **Requisition + exchange:** approved/rejected/fulfilled/cancelled; không email submit; warehouse nhận approved action; requester nhận direct results.
2. **Receipt + issue:** finance recipients chỉ khi posted/sale completed hoặc cancellation/reversal; internal issue chỉ warehouse khi cần action.
3. **Defect + repair:** technician action events; warehouse resolution event; requester result khi ảnh hưởng trực tiếp.
4. **Liquidation + stocktake:** warehouse khi approved; finance khi completed/variance; no-variance không gửi owner.
5. **Tools + transfer:** borrowed/returned/cancelled và transfer action recipients; actor exclusion.
6. **Fuel:** receipt finance events và driver direct events từ Task 5.

Cho mỗi lát:
- assert exact event key/payload/participants/actor;
- assert action không gọi `getManagerIds` hoặc tự query role email;
- chạy test feature tương ứng;
- commit theo domain hoặc một commit nếu tất cả thay đổi nhỏ và cùng verified state.

## Task 8 — Retire policy cũ và cập nhật admin broadcast

**Files:** `src/lib/notifications.ts`, callers, admin notification action/tests.  
**Why:** không để hai canonical owners tồn tại.  
**Retirement track:** internal delete-first; không xóa persistent data.

1. Grep baseline trước edit: `getManagerIds|notifyUsers\(|renderNotificationEmailHtml`.
2. Chuyển broadcast/test email sang explicit-channel API; broadcast là ngoại lệ đích danh do superuser chủ động, không đi qua business role registry.
3. Xóa `getManagerIds()` và tests cũ sau khi không còn caller.
4. Xóa business branches khỏi legacy `notifyUsers`; nếu wrapper không còn caller thì xóa toàn bộ wrapper, giữ primitives có tên rõ.
5. Chạy lingering-reference check; expected không còn role query `manager` trong notification policy và không còn business caller truyền role-derived `userIds`.
6. Chạy notification/admin tests.
7. Commit: `refactor(notifications): retire distributed email routing`.

## Task 9 — Đồng bộ tài liệu và contract reference

**Files:** email setup, database docs, design/index nếu trạng thái thay đổi, scheduler runbook.  
**Why:** tài liệu cũ hiện tuyên bố superuser nhận nghiệp vụ và sẽ trở thành sai authority.

1. Thay ma trận cũ trong `docs/DOMAIN_AND_EMAIL_SETUP.md` bằng event/role matrix đã duyệt và ghi rõ email thật vs `@mtp.local`.
2. Cập nhật database docs: `driver_id`, snapshot `driver_name`, delivery ledger và reminder claims.
3. Ghi rõ scheduler chưa active cho tới khi timer host được cài và kiểm tra; không tuyên bố production verified nếu manifest/evidence chưa có.
4. Chạy placeholder scan và `git diff --check` trên docs.
5. Commit: `docs: document role-based email operations`.

## Task 10 — Full verification, review và release evidence

1. Chạy focused suites:
   - `pnpm vitest run src/features/notifications src/lib/notifications.test.ts src/lib/email.test.ts src/features/fuel`
   - các action test đã sửa.
2. Chạy database: `pnpm test:db`.
3. Chạy static gates: `pnpm typecheck && pnpm lint`.
4. Chạy full regression: `pnpm test`.
5. Chạy production build: `pnpm build`.
6. Chạy grep negative:
   - không business email policy trong feature actions;
   - không `.in("role", ["manager", "superuser"])`;
   - không dò tài xế theo tên để gửi email;
   - không finance fields trong non-finance renderer.
7. Review độc lập hai tầng:
   - spec compliance: event matrix, actor exclusion, compatibility, reminder frequency;
   - code quality/security: idempotency race, PII logs, secret handling, RLS/ACL, HTML escaping.
8. Staging smoke test bằng SMTP sandbox: một event cho mỗi template kind; xác minh subject, recipient, CTA, mobile layout và delivery row.
9. Apply additive migration ở staging trước; backup/schema snapshot theo runbook; rollback ứng dụng không được drop cột/bảng mới.
10. Chỉ kích hoạt scheduler sau khi endpoint manual call và idempotency test pass. Production host change cần operator approval theo quy trình deploy hiện hành.

## 4. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Gửi trùng do retry/concurrency | unique idempotency key + transactional claim + state machine |
| Lộ dữ liệu tài chính | allowlisted DTO theo template + negative HTML tests |
| Mất in-app notification khi đổi email | channel primitives và test độc lập |
| Sai tài xế lịch sử | không backfill theo tên; nullable `driver_id`; giữ snapshot |
| RPC overload gây drift | một canonical implementation; overload cũ chỉ forward và có retirement trigger |
| Cron không chạy | protected manual endpoint, runbook, delivery/claim visibility; activation gate riêng |
| SMTP lỗi làm hỏng nghiệp vụ | dispatcher catch/log; không throw qua action |
| Workspace đang có nhiều thay đổi khác | mỗi task chụp `git status`, chỉ stage path sở hữu; không reset/overwrite file ngoài scope |

## 5. Retirement and rollback

### Retirement

- Retire `getManagerIds()` và mọi role-email query trong feature action.
- Retire business usage của generic `notifyUsers()`.
- Không giữ distributed policy làm fallback.
- RPC overload cũ (nếu cần) chỉ là compatibility forwarding; retirement trigger là không còn caller theo generated types/grep và hết cửa sổ deploy một phiên bản.

### Rollback

- App rollback có thể quay lại artifact trước; additive DB columns/tables giữ nguyên, không drop.
- Scheduler rollback bằng disable timer/cron, không xóa claim/delivery records.
- Nếu template lỗi, dừng dispatcher cho event bị ảnh hưởng bằng code rollback; không tái kích hoạt role lists phân tán.
- Không xóa dữ liệu lịch sử trong bất kỳ rollback nào của workstream này.

## 6. Execution Readiness View

- **Intent Lock:** Phương án B; email tức thời, đúng vai trò/người liên quan.
- **Scope Fence:** registry, driver linkage, reminder, templates, logs/idempotency, producer migration, docs; không digest/preferences/SMS/queue provider.
- **Baseline Lock:** Design Spec Approved ngày 2026-09-19 và canonical 7 roles.
- **Owner/Contract Constraints:** registry là policy owner; email transport không chọn recipient; feature action chỉ phát event.
- **Compatibility Boundary:** nullable `driver_id`, preserve `driver_name`, no guessed backfill, best-effort SMTP, in-app independent.
- **Retirement Boundary:** delete distributed role routing after event cutover; no persistent deletion.
- **Task Batches:** core contract → additive DB → resolver/templates → fuel/reminders → producers → retirement/docs → full verification.
- **Test Obligations:** strict RED/GREEN for shared contracts; SQL tests; negative security tests; full gates.
- **Review Gates:** after core registry/DB; after producer cutover; before release.
- **Drift/Rewind:** any new role, delivery channel, destructive migration or queue provider returns to Design Spec approval.
- **Evidence Before Completion:** commands in Task 10, grep retirement proof, staging SMTP sample, scheduler manual/idempotency proof.
- **Advisory Boundary:** planning guidance only; production migration/timer activation follows deployment authority.

## 7. Execution route

- **Decision:** subagent-driven for isolated DB contract, core notification engine, fuel UI and docs/review slices; coordinator integrates producer migrations sequentially where shared files overlap.
- **Evidence:** tasks have bounded owners but feature actions and generated DB types require ordered integration.
- **Fallback:** inline execution if subagent support or workspace ownership conflicts.
- **User confirmation required:** no for code and additive migration files; yes later for any live production migration, timer installation, or destructive action.
