-- 0031_replacement_unique.sql — cho phép tạo lại yêu cầu Đổi mới sau khi phiếu bị huỷ/từ chối.
-- Trước đây: unique theo linked_defect_id cho MỌI trạng thái → 1 phiếu hỏng chỉ được 1
-- yêu cầu đổi mới suốt đời (kể cả cancelled/rejected), làm vỡ luồng tạo lại.
drop index if exists public.idx_requisitions_unique_replacement;

create unique index idx_requisitions_unique_replacement
  on public.requisitions (linked_defect_id)
  where (requisition_type = 'replacement'::requisition_type)
    and linked_defect_id is not null
    and status not in ('cancelled'::requisition_status, 'rejected'::requisition_status);
