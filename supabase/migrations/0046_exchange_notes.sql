-- 0046_exchange_notes.sql — phiếu Đổi Mới (tách khỏi phiếu yêu cầu)
create type public.exchange_status as enum
  ('pending','approved','issued','received','rejected','cancelled');
create sequence public.exchange_notes_seq;

create table public.exchange_notes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  linked_defect_id uuid not null references public.defect_notes(id),
  status public.exchange_status not null default 'pending',
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  issued_by uuid references public.profiles(id),
  received_by uuid references public.profiles(id),
  rejected_by uuid references public.profiles(id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  issued_at timestamptz,
  received_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz
);

create table public.exchange_note_items (
  id uuid primary key default gen_random_uuid(),
  exchange_note_id uuid not null references public.exchange_notes(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity int not null check (quantity > 0)
);

create index exchange_notes_defect_idx on public.exchange_notes(linked_defect_id);
create index exchange_note_items_note_idx on public.exchange_note_items(exchange_note_id);

-- Chống trùng: 1 HONG chỉ 1 phiếu Đổi Mới đang sống (rejected/cancelled → tạo lại được)
create unique index exchange_notes_active_unique
  on public.exchange_notes (linked_defect_id)
  where status in ('pending','approved','issued','received');

alter table public.exchange_notes enable row level security;
alter table public.exchange_note_items enable row level security;

-- SELECT: manager, hoặc người lập HONG liên kết (để xem chip trạng thái trên HONG).
-- INSERT/UPDATE/DELETE: KHÔNG có policy — chỉ qua RPC security definer.
create policy "exchange_notes_select" on public.exchange_notes for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.defect_notes d
    where d.id = linked_defect_id and d.reported_by = auth.uid()
  ));
create policy "exchange_note_items_select" on public.exchange_note_items for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.exchange_notes en
    join public.defect_notes d on d.id = en.linked_defect_id
    where en.id = exchange_note_id and d.reported_by = auth.uid()
  ));
