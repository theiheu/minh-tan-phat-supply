-- 0058_defect_warehouse_collection.sql — Theo dõi vật tư hỏng đã gửi về kho hay chưa
alter table public.defect_notes
  add column if not exists collected_at timestamptz,
  add column if not exists collected_by uuid references public.profiles(id);

-- Cập nhật các phiếu đã đổi mới hoặc đã đi sửa/hoàn tất thì mặc định coi như đã về kho
update public.defect_notes
set collected_at = created_at
where (status in ('in_repair', 'returned', 'liquidated') or id in (
  select linked_defect_id from public.exchange_notes where status in ('approved', 'issued', 'received')
)) and collected_at is null;

create or replace function public.mark_defect_collected(p_id uuid, p_by uuid, p_collected boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_collected then
    update public.defect_notes
    set collected_at = now(), collected_by = p_by, updated_at = now()
    where id = p_id;
  else
    update public.defect_notes
    set collected_at = null, collected_by = null, updated_at = now()
    where id = p_id;
  end if;
end;
$$;
