-- 0001_core.sql — categories + zones (core reference data)
create extension if not exists "uuid-ossp";

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
