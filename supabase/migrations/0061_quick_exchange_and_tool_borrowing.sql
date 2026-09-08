-- 0061_quick_exchange_and_tool_borrowing.sql — Đổi mới 1-1 cấp tốc & Mượn/Trả dụng cụ

-- 1. Thêm movement types cho mượn/trả dụng cụ
alter type public.movement_type add value if not exists 'tool_borrow_out';
alter type public.movement_type add value if not exists 'tool_return_in';

-- 2. Enum & Bảng Mượn Dụng Cụ
create type public.tool_borrowing_status as enum ('borrowed', 'returned', 'cancelled');
create sequence public.tool_borrowings_seq;

create table public.tool_borrowings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  borrower_id uuid not null references public.profiles(id),
  zone_id uuid references public.zones(id),
  purpose text not null,
  borrowed_at timestamptz not null default now(),
  expected_return_date date,
  returned_at timestamptz,
  issued_by uuid references public.profiles(id),
  received_back_by uuid references public.profiles(id),
  notes text,
  status public.tool_borrowing_status not null default 'borrowed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tool_borrowings_borrower_idx on public.tool_borrowings(borrower_id);
create index tool_borrowings_status_idx on public.tool_borrowings(status);

create table public.tool_borrowing_items (
  id uuid primary key default gen_random_uuid(),
  borrowing_id uuid not null references public.tool_borrowings(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity int not null check (quantity > 0),
  returned_quantity int not null default 0 check (returned_quantity >= 0),
  notes text
);

create index tool_borrowing_items_borrowing_idx on public.tool_borrowing_items(borrowing_id);

-- RLS
alter table public.tool_borrowings enable row level security;
alter table public.tool_borrowing_items enable row level security;

create policy "tool_borrowings_select" on public.tool_borrowings for select to authenticated
  using (public.is_manager() or borrower_id = auth.uid());

create policy "tool_borrowing_items_select" on public.tool_borrowing_items for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.tool_borrowings b where b.id = borrowing_id and b.borrower_id = auth.uid()
  ));

-- 3. RPC quick_emergency_exchange
create or replace function public.quick_emergency_exchange(
  p_variant_id uuid,
  p_quantity int,
  p_damage_detail text,
  p_images text[],
  p_zone_id uuid,
  p_by uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_defect_id uuid;
  v_exchange_id uuid;
  v_defect_code text;
  v_exchange_code text;
  v_main_loc uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_quantity <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  if p_images is null or array_length(p_images, 1) is null or array_length(p_images, 1) = 0 then
    raise exception 'Bắt buộc phải có ít nhất 1 ảnh hiện trường hỏng';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';

  -- 1. Tạo phiếu báo hỏng ở trạng thái staging
  v_defect_code := public.next_code('HONG', 'public.defect_notes_seq'::regclass);
  insert into public.defect_notes (code, source_location_id, reported_by, status)
  values (v_defect_code, v_main_loc, p_by, 'staging')
  returning id into v_defect_id;

  insert into public.defect_note_items (defect_note_id, variant_id, quantity, damage_detail, images, note)
  values (v_defect_id, p_variant_id, p_quantity, p_damage_detail, p_images, 'Đổi mới khẩn cấp 1-1');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.create', 'defect', v_defect_id, jsonb_build_object('status', 'staging', 'emergency', true));

  -- 2. Tạo phiếu Đổi Mới và duyệt thẳng (approved)
  v_exchange_code := public.next_code('DM', 'public.exchange_notes_seq'::regclass);
  insert into public.exchange_notes (code, linked_defect_id, created_by, approved_by, approved_at, status)
  values (v_exchange_code, v_defect_id, p_by, p_by, now(), 'approved')
  returning id into v_exchange_id;

  insert into public.exchange_note_items (exchange_note_id, variant_id, quantity)
  values (v_exchange_id, p_variant_id, p_quantity);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'exchange.create_emergency', 'exchange', v_exchange_id, jsonb_build_object('status', 'approved'));

  return jsonb_build_object(
    'defect_id', v_defect_id,
    'defect_code', v_defect_code,
    'exchange_id', v_exchange_id,
    'exchange_code', v_exchange_code
  );
end;
$$;

-- 4. RPC create_tool_borrowing
create or replace function public.create_tool_borrowing(
  p_items jsonb,
  p_zone_id uuid,
  p_purpose text,
  p_expected_return_date date,
  p_borrower_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
  v_main_loc uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_purpose is null or length(trim(p_purpose)) = 0 then raise exception 'Mục đích mượn không được để trống'; end if;
  if p_borrower_id is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ quản lý kho mới được tạo phiếu mượn hộ người khác';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';
  v_code := public.next_code('MDC', 'public.tool_borrowings_seq'::regclass);

  insert into public.tool_borrowings (
    code, borrower_id, zone_id, purpose, expected_return_date, issued_by, status
  )
  values (
    v_code, p_borrower_id, p_zone_id, p_purpose, p_expected_return_date, auth.uid(), 'borrowed'
  )
  returning id into v_id;

  -- Trừ tồn kho Kho chính & ghi ledger tool_borrow_out
  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.tool_borrowing_items (borrowing_id, variant_id, quantity)
    values (v_id, (it.value->>'variant_id')::uuid, (it.value->>'quantity')::int);

    perform public._move_stock(
      (it.value->>'variant_id')::uuid,
      v_main_loc,
      null,
      (it.value->>'quantity')::int,
      'tool_borrow_out',
      'tool_borrowing',
      v_id,
      auth.uid(),
      'Xuất mượn dụng cụ: ' || p_purpose
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'tool_borrowing.create', 'tool_borrowing', v_id, jsonb_build_object('status', 'borrowed', 'code', v_code));

  return v_id;
end;
$$;

-- 5. RPC return_tool_borrowing
create or replace function public.return_tool_borrowing(
  p_borrowing_id uuid,
  p_items jsonb,
  p_notes text,
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.tool_borrowing_status;
  v_main_loc uuid;
  v_all_returned boolean := true;
  it record;
  v_borrowed_qty int;
  v_already_returned int;
  v_return_qty int;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được xác nhận nhận lại dụng cụ'; end if;

  select status into v_status from public.tool_borrowings where id = p_borrowing_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu mượn'; end if;
  if v_status <> 'borrowed' then raise exception 'Phiếu không ở trạng thái đang mượn (hiện tại: %)', v_status; end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';

  for it in select value from jsonb_array_elements(p_items) loop
    v_return_qty := (it.value->>'quantity')::int;
    if v_return_qty <= 0 then continue; end if;

    select quantity, returned_quantity into v_borrowed_qty, v_already_returned
    from public.tool_borrowing_items
    where borrowing_id = p_borrowing_id and variant_id = (it.value->>'variant_id')::uuid
    for update;

    if v_borrowed_qty is null then
      raise exception 'Dụng cụ % không có trong phiếu mượn', it.value->>'variant_id';
    end if;

    if v_already_returned + v_return_qty > v_borrowed_qty then
      raise exception 'Số lượng trả vượt quá số lượng còn đang mượn';
    end if;

    update public.tool_borrowing_items
    set returned_quantity = returned_quantity + v_return_qty
    where borrowing_id = p_borrowing_id and variant_id = (it.value->>'variant_id')::uuid;

    perform public._move_stock(
      (it.value->>'variant_id')::uuid,
      null,
      v_main_loc,
      v_return_qty,
      'tool_return_in',
      'tool_borrowing',
      p_borrowing_id,
      p_by,
      'Nhận trả dụng cụ'
    );
  end loop;

  -- Kiểm tra xem tất cả các món đã trả đủ chưa
  if exists (
    select 1 from public.tool_borrowing_items
    where borrowing_id = p_borrowing_id and returned_quantity < quantity
  ) then
    v_all_returned := false;
  end if;

  if v_all_returned then
    update public.tool_borrowings
    set status = 'returned', returned_at = now(), received_back_by = p_by, notes = coalesce(notes || E'\n', '') || coalesce(p_notes, '')
    where id = p_borrowing_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'tool_borrowing.return', 'tool_borrowing', p_borrowing_id, jsonb_build_object('all_returned', v_all_returned, 'items', p_items));
end;
$$;

-- 6. RPC cancel_tool_borrowing
create or replace function public.cancel_tool_borrowing(
  p_borrowing_id uuid,
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.tool_borrowing_status;
  v_borrower uuid;
  v_main_loc uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status, borrower_id into v_status, v_borrower from public.tool_borrowings where id = p_borrowing_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu mượn'; end if;
  if v_status <> 'borrowed' then raise exception 'Chỉ có thể hủy phiếu đang mượn'; end if;
  if v_borrower is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ người mượn hoặc quản lý mới được hủy phiếu';
  end if;

  -- Không cho hủy nếu đã có dòng trả lại
  if exists (
    select 1 from public.tool_borrowing_items where borrowing_id = p_borrowing_id and returned_quantity > 0
  ) then
    raise exception 'Phiếu đã có dụng cụ được trả, không thể hủy';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';

  -- Hoàn trả tồn kho Kho chính
  for it in select variant_id, quantity from public.tool_borrowing_items where borrowing_id = p_borrowing_id loop
    perform public._move_stock(
      it.variant_id,
      null,
      v_main_loc,
      it.quantity,
      'tool_return_in',
      'tool_borrowing',
      p_borrowing_id,
      p_by,
      'Hủy phiếu mượn dụng cụ'
    );
  end loop;

  update public.tool_borrowings set status = 'cancelled' where id = p_borrowing_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'tool_borrowing.cancel', 'tool_borrowing', p_borrowing_id, jsonb_build_object('status', 'cancelled'));
end;
$$;
