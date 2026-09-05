-- 0004_catalog.sql — products + variants + variant_components
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  images text[] not null default '{}',
  category_id uuid references public.categories(id) on delete set null,
  options text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attributes jsonb not null default '{}'::jsonb,
  price numeric(12,2),
  images text[] not null default '{}',
  unit text,
  min_stock integer not null default 0,
  is_trackable_lot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.variant_components (
  id uuid primary key default gen_random_uuid(),
  parent_variant_id uuid not null references public.variants(id) on delete cascade,
  child_variant_id uuid not null references public.variants(id) on delete cascade,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  unique (parent_variant_id, child_variant_id)
);
