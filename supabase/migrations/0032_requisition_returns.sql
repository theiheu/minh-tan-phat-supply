-- 0032_requisition_returns.sql — lịch sử trả lại vật tư của phiếu yêu cầu
create table public.requisition_returns (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.requisitions(id) on delete cascade,
  returned_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.requisition_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.requisition_returns(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity integer not null check (quantity > 0)
);

create index requisition_returns_requisition_id_idx on public.requisition_returns(requisition_id);
create index requisition_return_items_return_id_idx on public.requisition_return_items(return_id);

alter table public.requisition_returns enable row level security;
alter table public.requisition_return_items enable row level security;

create policy "requisition_returns_select" on public.requisition_returns for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.requisitions r where r.id = requisition_id and r.requester_id = auth.uid()
  ));

create policy "requisition_return_items_select" on public.requisition_return_items for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.requisition_returns rr
    join public.requisitions r on r.id = rr.requisition_id
    where rr.id = return_id and r.requester_id = auth.uid()
  ));

-- ===========================================================================
-- return_requisition_items: giữ nguyên gate/check, thêm ghi header + dòng lịch sử
-- ===========================================================================
create or replace function public.return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.requisition_status;
  v_requester uuid;
  v_main uuid;
  v_return_id uuid;
  it record;
  v_issued int;
  v_returned int;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status, requester_id into v_status, v_requester from public.requisitions where id = p_requisition_id for update;
  if v_requester is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ người yêu cầu hoặc quản lý kho được nhập trả lại';
  end if;
  if v_status not in ('issued','received') then raise exception 'Phiếu chưa cấp phát nên không thể trả lại (hiện tại: %)', v_status; end if;

  insert into public.requisition_returns (requisition_id, returned_by)
  values (p_requisition_id, auth.uid())
  returning id into v_return_id;

  for it in select value from jsonb_array_elements(p_items) loop
    select quantity into v_issued from public.requisition_items
    where requisition_id = p_requisition_id and variant_id = (it.value->>'variant_id')::uuid;
    if v_issued is null then raise exception 'Variant % không có trong phiếu', it.value->>'variant_id'; end if;

    select coalesce(sum(quantity),0) into v_returned from public.stock_movements
    where ref_type = 'requisition' and ref_id = p_requisition_id
      and variant_id = (it.value->>'variant_id')::uuid and movement_type = 'return_in';

    if (it.value->>'quantity')::int > v_issued - v_returned then
      raise exception 'Số lượng trả vượt quá số đã cấp cho variant %', it.value->>'variant_id';
    end if;

    perform public._move_stock(
      (it.value->>'variant_id')::uuid, null, v_main,
      (it.value->>'quantity')::int, 'return_in', 'requisition', p_requisition_id, p_by);

    insert into public.requisition_return_items (return_id, variant_id, quantity)
    values (v_return_id, (it.value->>'variant_id')::uuid, (it.value->>'quantity')::int);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'requisition.return', 'requisition', p_requisition_id, jsonb_build_object('items', p_items));
end;
$$;
