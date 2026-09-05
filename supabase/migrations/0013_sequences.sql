-- 0013_sequences.sql — sinh mã phiếu
create sequence public.requisitions_seq;
create sequence public.receipts_seq;
create sequence public.defect_notes_seq;
create sequence public.repair_orders_seq;
create sequence public.liquidation_notes_seq;
create sequence public.stocktake_seq;

create or replace function public.next_code(prefix text, seq regclass)
returns text language plpgsql as $$
begin
  return prefix || '-' || lpad(nextval(seq)::text, 4, '0');
end;
$$;
