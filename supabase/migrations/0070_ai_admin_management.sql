-- 0070_ai_admin_management.sql
-- Quản trị hệ thống AI Copilot: Cài đặt hệ thống, Gợi ý tra cứu nhanh, Lịch sử hội thoại toàn hệ thống.

-- 1. Bảng Cài đặt cấu hình AI (ai_system_settings)
create table if not exists public.ai_system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Seed các cấu hình mặc định
insert into public.ai_system_settings (key, value, description)
values
  ('ai_enabled', 'true'::jsonb, 'Bật hoặc tắt chức năng AI Copilot trên toàn hệ thống'),
  ('ai_model', '"auto/fast"'::jsonb, 'Model AI mặc định sử dụng trên Omniroute'),
  ('ai_max_tokens', '1500'::jsonb, 'Giới hạn số token tối đa cho mỗi câu trả lời')
on conflict (key) do nothing;

-- 2. Bảng Gợi ý tra cứu nhanh (ai_quick_prompts)
create table if not exists public.ai_quick_prompts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  prompt text not null,
  icon text not null default 'PackageSearch',
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed các câu hỏi gợi ý nhanh ban đầu
insert into public.ai_quick_prompts (label, prompt, icon, display_order, is_active)
values
  ('Tồn kho động cơ & van bi', 'Tra cứu tồn kho thực tế của động cơ điện và van bi ở các kho hiện tại.', 'PackageSearch', 1, true),
  ('Vật tư sắp cạn kho', 'Quét danh sách các vật tư đang có số lượng dưới mức tồn tối thiểu.', 'AlertTriangle', 2, true),
  ('Báo cáo xăng dầu gần đây', 'Tổng hợp các lần cấp phát xăng dầu gần đây nhất cho các xe và máy móc.', 'Fuel', 3, true),
  ('Quy trình Đổi 1-1', 'Hướng dẫn quy trình đổi 1-1 cấp tốc khi thiết bị hỏng tại chuồng trại.', 'BookOpen', 4, true)
on conflict do nothing;

-- 3. RLS cho ai_system_settings và ai_quick_prompts
alter table public.ai_system_settings enable row level security;
alter table public.ai_quick_prompts enable row level security;

-- Mọi user đã đăng nhập đều đọc được quick prompts và ai_enabled
drop policy if exists "Authenticated users can read ai settings" on public.ai_system_settings;
create policy "Authenticated users can read ai settings"
  on public.ai_system_settings for select to authenticated using (true);

drop policy if exists "Authenticated users can read active quick prompts" on public.ai_quick_prompts;
create policy "Authenticated users can read active quick prompts"
  on public.ai_quick_prompts for select to authenticated using (true);

-- 4. Bổ sung chính sách Admin cho Conversation & Message
-- Cho phép Admin/Owner/Warehouse/Accountant đọc tất cả conversations và messages để audit
drop policy if exists "Managers can view all conversations" on public.ai_conversations;
create policy "Managers can view all conversations"
  on public.ai_conversations for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'warehouse', 'accountant', 'superuser')
    )
  );

drop policy if exists "Managers can view all messages" on public.ai_messages;
create policy "Managers can view all messages"
  on public.ai_messages for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'warehouse', 'accountant', 'superuser')
    )
  );
