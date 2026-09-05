-- 0008_repairs.sql — sửa chữa
create type public.repair_status as enum ('in_repair','returned','cancelled');
create type public.repair_outcome as enum ('returned_to_stock','liquidation');

create table public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  vendor text not null,
  sent_at date,
  expected_return_at date,
  returned_at timestamptz,
  status public.repair_status not null default 'in_repair',
  total_cost numeric(12,2),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repair_order_items (
  id uuid primary key default gen_random_uuid(),
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  defect_item_id uuid references public.defect_note_items(id),
  variant_id uuid not null references public.variants(id),
  quantity integer not null default 1 check (quantity > 0),
  repair_detail text,
  cost numeric(12,2),
  outcome public.repair_outcome,
  created_at timestamptz not null default now()
);
