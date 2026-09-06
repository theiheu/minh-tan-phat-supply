-- 0049_defect_note_notes.sql — ghi chú tuỳ chọn cho từng dòng phiếu hỏng
alter table public.defect_note_items
  add column note text;

-- record_defect — bản mới nhận thêm trường note (tuỳ chọn) cho từng dòng
create or replace function public.record_defect(p_items jsonb, p_source_loc uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_defect_loc uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select id into v_defect_loc from public.stock_locations where code = 'KHO_HONG';

  insert into public.defect_notes (code, source_location_id, reported_by)
  values (public.next_code('HONG', 'public.defect_notes_seq'::regclass), p_source_loc, p_by)
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.defect_note_items
      (defect_note_id, variant_id, quantity, damage_detail, damage_type, severity, images, unit_cost, note)
    values (
      v_id,
      (it.value->>'variant_id')::uuid,
      (it.value->>'quantity')::int,
      it.value->>'damage_detail',
      nullif(it.value->>'damage_type','')::public.damage_type,
      nullif(it.value->>'severity','')::public.severity_level,
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(it.value->'images','[]'::jsonb)) as x), '{}'),
      nullif(it.value->>'unit_cost','')::numeric,
      nullif(btrim(it.value->>'note',''),'')
    );

    perform public._move_stock(
      (it.value->>'variant_id')::uuid, p_source_loc, v_defect_loc,
      (it.value->>'quantity')::int, 'defect_out', 'defect', v_id, p_by);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.record', 'defect', v_id, jsonb_build_object('status','staging'));
  return v_id;
end;
$$;
