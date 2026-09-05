-- 0009_liquidations.sql — thanh lý
create type public.liquidation_status as enum ('pending','approved','completed','rejected','cancelled');
create type public.liquidation_method as enum ('sale','dispose');

create table public.liquidation_notes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  reason text,
  status public.liquidation_status not null default 'pending',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.liquidation_items (
  id uuid primary key default gen_random_uuid(),
  liquidation_note_id uuid not null references public.liquidation_notes(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  source_item_id uuid,
  quantity integer not null default 1 check (quantity > 0),
  method public.liquidation_method not null default 'dispose',
  unit_value numeric(12,2),
  proceeds numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
