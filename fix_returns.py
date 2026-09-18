import sys
import re

content = open('supabase/migrations/0001_baseline.sql').read()

block_old = """insert into public.requisition_returns(requisition_id,returned_by)
  values(p_requisition_id,p_by) returning id into v_return_id;"""

block_new = """if p_operation_key is null then p_operation_key := gen_random_uuid()::text; end if;

  begin
    insert into public.requisition_returns(requisition_id, returned_by, operation_key, payload_hash)
    values(p_requisition_id, p_by, p_operation_key, md5(p_items::text))
    returning id into v_return_id;
  exception when unique_violation then
    select id into v_return_id from public.requisition_returns
    where requisition_id=p_requisition_id and operation_key=p_operation_key and payload_hash=md5(p_items::text);
    if v_return_id is not null then return v_return_id; end if;
    raise exception 'Conflict: Return operation key already used with different payload';
  end;"""
if block_old in content:
   content = content.replace(block_old, block_new)

key_old = "'idempotency_key', 'return-req-' || p_requisition_id::text || '-' || gen_random_uuid()::text,"
key_new = "'idempotency_key', 'return-req-' || p_requisition_id::text || '-' || p_operation_key,"

if key_old in content:
   content = content.replace(key_old, key_new)

content = content.replace("jsonb_build_object('status', v_status, 'return_id', v_return_id));\nend;", "jsonb_build_object('status', v_status, 'return_id', v_return_id));\n  return v_return_id;\nend;")

open('supabase/migrations/0001_baseline.sql', 'w').write(content)
