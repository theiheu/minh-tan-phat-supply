"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Công cụ DEV (chỉ superuser — RPC phía DB tự kiểm is_superuser()):
 * mở lại phiếu đã ghi sổ về trạng thái sửa được, hoặc xoá phiếu (đã ghi sổ sẽ đảo bút toán trước).
 * Mỗi module có RPC riêng (migration 0042 + 0043).
 */
export type DevDocKind = "issue" | "liquidation" | "receipt" | "requisition" | "stocktake" | "defect" | "repair";

type Callable = Awaited<ReturnType<typeof createClient>>;

/** Gọi RPC mở lại (revert) theo loại — tên literal để đúng type supabase. */
async function reopenByKind(supabase: Callable, kind: DevDocKind, id: string, pBy: string) {
  const { error } =
    kind === "issue"
      ? await supabase.rpc("revert_issue", { p_id: id, p_by: pBy })
      : kind === "liquidation"
        ? await supabase.rpc("revert_liquidation", { p_id: id, p_by: pBy })
        : kind === "receipt"
          ? await supabase.rpc("revert_receipt", { p_id: id, p_by: pBy })
          : kind === "requisition"
            ? await supabase.rpc("revert_requisition", { p_id: id, p_by: pBy })
            : kind === "repair"
              ? await supabase.rpc("revert_repair", { p_id: id, p_by: pBy })
              : await supabase.rpc("revert_stocktake", { p_session_id: id, p_by: pBy });
  if (error) throw new Error(error.message);
}

/** Gọi RPC xoá theo loại — tên literal để đúng type supabase. */
async function deleteByKind(supabase: Callable, kind: DevDocKind, id: string, pBy: string) {
  const { error } =
    kind === "issue"
      ? await supabase.rpc("delete_issue", { p_id: id, p_by: pBy })
      : kind === "liquidation"
        ? await supabase.rpc("delete_liquidation", { p_id: id, p_by: pBy })
        : kind === "receipt"
          ? await supabase.rpc("delete_receipt", { p_id: id, p_by: pBy })
          : kind === "requisition"
            ? await supabase.rpc("delete_requisition", { p_id: id, p_by: pBy })
            : kind === "defect"
              ? await supabase.rpc("delete_defect", { p_id: id, p_by: pBy })
              : kind === "repair"
                ? await supabase.rpc("delete_repair", { p_id: id, p_by: pBy })
                : await supabase.rpc("delete_stocktake", { p_session_id: id, p_by: pBy });
  if (error) throw new Error(error.message);
}

/** Các route cần refresh vì tồn kho / danh sách thay đổi. */
const ROUTES = [
  "/issues",
  "/receipts",
  "/requisitions",
  "/liquidations",
  "/stocktake",
  "/defects",
  "/repairs",
  "/dashboard",
  "/products",
];

export async function devReopenDoc(kind: DevDocKind, id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  await reopenByKind(supabase, kind, id, profile.id);
  for (const p of ROUTES) revalidatePath(p);
}

export async function devDeleteDoc(kind: DevDocKind, id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  await deleteByKind(supabase, kind, id, profile.id);
  for (const p of ROUTES) revalidatePath(p);
}
