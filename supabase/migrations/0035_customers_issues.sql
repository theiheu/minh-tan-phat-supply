-- 0035_customers_issues.sql — khách hàng + phiếu xuất kho (additive).

-- 1) Khách hàng (bên nhận hàng khi xuất bán)
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_name_active_key on public.customers (name) where deleted_at is null and is_active;

-- 2) movement_type thêm giá trị issue_out
alter type public.movement_type add value if not exists 'issue_out';

-- 3) Phiếu xuất kho
create sequence public.issues_seq;
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  destination_type text not null check (destination_type in ('zone','customer')),
  zone_id uuid references public.zones(id),
  customer_id uuid references public.customers(id),
  vehicle_plate text,
  driver_name text,
  creator_id uuid not null references public.profiles(id),
  notes text,
  status text not null default 'draft' check (status in ('draft','posted','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (destination_type = 'zone' and zone_id is not null and customer_id is null) or
    (destination_type = 'customer' and customer_id is not null and zone_id is null)
  )
);
create table public.issue_items (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2),
  created_at timestamptz not null default now()
);
create index issue_items_issue_idx on public.issue_items (issue_id);
create index issues_status_created_idx on public.issues (status, created_at);

-- 4) View tồn theo từng kho (composite bung linh kiện) — dùng cho bảng tồn in
-- security_invoker để view tôn trọng RLS của các bảng bên dưới (như 0019_stock_view.sql).
create or replace view public.location_stock
with (security_invoker = true) as
select
  sb.location_id,
  v.id as variant_id,
  v.product_id,
  case
    when exists (select 1 from public.variant_components vc where vc.parent_variant_id = v.id) then (
      select min(sb2.quantity / greatest(vc.quantity, 1))
      from public.variant_components vc
      join public.stock_balances sb2 on sb2.variant_id = vc.child_variant_id and sb2.location_id = sb.location_id
      where vc.parent_variant_id = v.id
    )
    else sb.quantity
  end as quantity
from public.stock_balances sb
join public.variants v on v.id = sb.variant_id;

-- 5) RLS — theo pattern 0016_rls.sql: policy tách theo thao tác, `to authenticated`,
--    mọi ghi/đọc hạn chế đều qua public.is_manager().
alter table public.customers enable row level security;
alter table public.issues enable row level security;
alter table public.issue_items enable row level security;

-- customers: danh mục dùng chung (như suppliers) — đọc cho mọi authenticated, ghi manager.
create policy "customers_select" on public.customers for select to authenticated using (true);
create policy "customers_insert" on public.customers for insert to authenticated with check (public.is_manager());
create policy "customers_update" on public.customers for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "customers_delete" on public.customers for delete to authenticated using (public.is_manager());

-- issues / issue_items: phiếu xuất kho — manager only (như receipts ở 0016).
create policy "issues_select" on public.issues for select to authenticated using (public.is_manager());
create policy "issues_insert" on public.issues for insert to authenticated with check (public.is_manager());
create policy "issues_update" on public.issues for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "issues_delete" on public.issues for delete to authenticated using (public.is_manager());

create policy "issue_items_select" on public.issue_items for select to authenticated using (public.is_manager());
create policy "issue_items_insert" on public.issue_items for insert to authenticated with check (public.is_manager());
create policy "issue_items_update" on public.issue_items for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "issue_items_delete" on public.issue_items for delete to authenticated using (public.is_manager());

-- 6) Audit trigger updated_at — dùng trigger chuẩn public.set_updated_at (0014_triggers.sql)
--    cho mọi bảng mới có cột updated_at.
create trigger trg_customers_updated before update on public.customers for each row execute function public.set_updated_at();
create trigger trg_issues_updated before update on public.issues for each row execute function public.set_updated_at();
