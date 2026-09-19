DROP FUNCTION IF EXISTS public.return_requisition_items(uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.return_requisition_items(uuid, jsonb, uuid, text);

CREATE OR REPLACE FUNCTION public.return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid, p_operation_key text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.requisition_status;
  v_req_code text;
  it record;
  qty int;
  existing_rq int;
  v_main uuid;
  v_lines jsonb := '[]'::jsonb;
  v_return_id uuid;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được nhận trả vật tư'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status, code into v_status, v_req_code from public.requisitions where id = p_requisition_id for update;
  if v_status not in ('issued', 'received') then
    raise exception 'Chỉ có thể trả lại hàng từ phiếu đã cấp phát / đã nhận (hiện tại: %)', v_status;
  end if;

  if p_operation_key is null or trim(p_operation_key) = '' then
    raise exception 'Operation key bắt buộc để đảm bảo idempotency';
  end if;

  begin
    insert into public.requisition_returns(requisition_id, returned_by, operation_key, payload_hash)
    values(p_requisition_id, p_by, p_operation_key, md5(p_items::text))
    returning id into v_return_id;
  exception when unique_violation then
    select id into v_return_id from public.requisition_returns
    where requisition_id=p_requisition_id and operation_key=p_operation_key and payload_hash=md5(p_items::text);
    
    if v_return_id is not null then 
      return; 
    end if;
    
    raise exception 'Conflict: Return operation key already used with different payload';
  end;

  for it in select value from jsonb_array_elements(p_items) loop
    qty := coalesce((it.value->>'quantity')::int, (it.value->>'entered_quantity')::int);
    select ri.quantity - coalesce((
      select sum(rri.quantity) from public.requisition_returns rr
      join public.requisition_return_items rri on rri.return_id=rr.id
      where rr.requisition_id=p_requisition_id and rri.sku_id=ri.sku_id
    ),0) into existing_rq
    from public.requisition_items ri
    where ri.requisition_id=p_requisition_id and ri.sku_id=(it.value->>'sku_id')::uuid;

    if existing_rq is null then raise exception 'Vật tư % không có trong phiếu yêu cầu', it.value->>'sku_id'; end if;
    if qty > existing_rq then raise exception 'Số lượng trả (%) vượt số lượng còn lại (%)', qty, existing_rq; end if;

    insert into public.requisition_return_items (return_id, sku_id, quantity, transaction_unit_id, entered_quantity)
    values (
      v_return_id, 
      (it.value->>'sku_id')::uuid, 
      qty, 
      nullif(it.value->>'transaction_unit_id','')::uuid,
      coalesce((it.value->>'entered_quantity')::numeric, qty)
    );

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'sku_id', (it.value->>'sku_id')::uuid,
        'to_location_id', v_main,
        'entered_quantity', coalesce((it.value->>'entered_quantity')::numeric, qty),
        'transaction_unit_id', nullif(it.value->>'transaction_unit_id','')::uuid
      )
    );
  end loop;

  if jsonb_array_length(v_lines) > 0 then
    perform public.post_return_command(jsonb_build_object(
      'document_id', p_requisition_id,
      'idempotency_key', 'return-req-' || p_requisition_id::text || '-' || p_operation_key,
      'notes', 'Trả lại theo phiếu ' || v_req_code,
      'lines', v_lines
    ));
  end if;
end;
$$;
