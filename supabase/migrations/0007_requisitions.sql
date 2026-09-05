-- 0007_requisitions.sql — phiếu yêu cầu (nhiều trạng thái)
create type public.requisition_type as enum ('new_supply','replacement');
create type public.requisition_status as enum (
  'draft','pending','approved','issued','received','rejected','cancelled'
);

create table public.requisitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  requester_id uuid not null references public.profiles(id),
  zone_id uuid references public.zones(id) on delete set null,
  purpose text not null,
  requisition_type public.requisition_type not null default 'new_supply',
  linked_defect_id uuid references public.defect_notes(id),
  status public.requisition_status not null default 'draft',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  fulfilled_by uuid references public.profiles(id),
  fulfilled_at timestamptz,
  fulfillment_notes text,
  received_by uuid references public.profiles(id),
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requisition_items (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.requisitions(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
