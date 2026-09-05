-- 0010_receipts.sql — phiếu nhập kho (có lô/hạn, trạng thái)
create type public.receipt_status as enum ('draft','posted','cancelled');

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status public.receipt_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id),
  linked_requisition_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2),
  batch_no text,
  expiry_date date,
  created_at timestamptz not null default now()
);
