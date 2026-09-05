-- 0006_defects.sql — vật tư hỏng (TRƯỚC requisitions vì FK linked_defect_id)
create type public.defect_status as enum ('staging','in_repair','returned','liquidated','cancelled');
create type public.severity_level as enum ('light','medium','severe');
create type public.damage_type as enum ('cracked','chipped','broken','worn','electrical','chemical','other');
create type public.defect_resolution as enum ('repaired','liquidated');

create table public.defect_notes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  source_location_id uuid references public.stock_locations(id),
  reported_by uuid references public.profiles(id),
  status public.defect_status not null default 'staging',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.defect_note_items (
  id uuid primary key default gen_random_uuid(),
  defect_note_id uuid not null references public.defect_notes(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity integer not null default 1 check (quantity > 0),
  damage_detail text,
  damage_type public.damage_type,
  severity public.severity_level,
  images text[] not null default '{}',
  unit_cost numeric(12,2),
  resolution public.defect_resolution,
  created_at timestamptz not null default now()
);
