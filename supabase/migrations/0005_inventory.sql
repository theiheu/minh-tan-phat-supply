-- 0005_inventory.sql — stock locations + balances + movements (ledger)
create type public.location_type as enum ('main','defect','repair','other');

create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type public.location_type not null default 'main',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  location_id uuid not null references public.stock_locations(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (variant_id, location_id)
);

create type public.movement_type as enum (
  'receipt_in','requisition_out','return_in','defect_out','repair_out',
  'repair_return_in','liquidation_out','adjustment_in','adjustment_out','transfer'
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id),
  from_location_id uuid references public.stock_locations(id),
  to_location_id uuid references public.stock_locations(id),
  movement_type public.movement_type not null,
  quantity integer not null,
  ref_type text,
  ref_id uuid,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
