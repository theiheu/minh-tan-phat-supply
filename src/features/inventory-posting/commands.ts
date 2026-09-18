import type { PostingCommand, PostingRpcCommand, ReservationCommand } from "./types";
import { postingCommandSchema, reservationCommandSchema } from "./types";

export function toPostingRpcCommand(input: PostingCommand): PostingRpcCommand {
  const parsed = postingCommandSchema.parse(input);
  return {
    document_type: parsed.documentType,
    document_id: parsed.documentId,
    ...(parsed.idempotencyKey ? { idempotency_key: parsed.idempotencyKey } : {}),
    ...(parsed.notes ? { notes: parsed.notes } : {}),
    lines: parsed.lines.map((line) => ({
      sku_id: line.skuId,
      ...(line.fromLocationId ? { from_location_id: line.fromLocationId } : {}),
      ...(line.toLocationId ? { to_location_id: line.toLocationId } : {}),
      entered_quantity: line.enteredQuantity,
      ...(line.transactionUnitId ? { transaction_unit_id: line.transactionUnitId } : {}),
      ...(line.unitCost !== undefined ? { unit_cost: line.unitCost } : {}),
      ...(line.sourceLineId ? { source_line_id: line.sourceLineId } : {}),
      ...(line.allocations
        ? {
            allocations: line.allocations.map((allocation) => ({
              ...(allocation.lotId ? { lot_id: allocation.lotId } : {}),
              ...(allocation.serialId ? { serial_id: allocation.serialId } : {}),
              quantity: allocation.quantity,
            })),
          }
        : {}),
    })),
  };
}

export function toReservationRpcCommand(input: ReservationCommand) {
  const parsed = reservationCommandSchema.parse(input);
  return {
    sku_id: parsed.skuId,
    location_id: parsed.locationId,
    source_document_type: parsed.sourceDocumentType,
    source_document_id: parsed.sourceDocumentId,
    source_document_line_id: parsed.sourceDocumentLineId,
    base_quantity: parsed.baseQuantity,
    ...(parsed.idempotencyKey ? { idempotency_key: parsed.idempotencyKey } : {}),
  };
}
