-- 0012_stocktake.sql — kiểm kê
create type public.stocktake_status as enum ('draft','posted','cancelled');

create table public.stocktake_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  location_id uuid not null references public.stock_locations(id),
  status public.stocktake_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table public.stocktake_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.stocktake_sessions(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  system_qty integer not null default 0,
  actual_qty integer not null default 0,
  created_at timestamptz not null default now()
);
