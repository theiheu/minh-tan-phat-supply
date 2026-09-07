"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REQUISITION_STATUS, statusBadgeVariant } from "@/lib/labels";
import { useUIStore } from "@/stores/ui-store";

interface RecentRequisitionItem {
  id: string;
  code: string;
  purpose: string;
  status: string;
  requester?: { name: string | null } | null;
  zone?: { name: string } | null;
}

export function RecentRequisitionsCard({
  items,
}: {
  items: RecentRequisitionItem[];
}) {
  const openSlipModal = useUIStore((s) => s.openSlipModal);

  return (
    <Card className="border-2 border-border shadow-xs rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Phiếu yêu cầu cần xử lý</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Không có phiếu yêu cầu đang chờ xử lý.</p>
        ) : (
          <ul className="divide-y">
            {items.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => openSlipModal("requisition", r.id)}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:text-primary group"
                >
                  <span className="font-mono text-xs font-semibold text-primary group-hover:underline">
                    {r.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {r.requester?.name ?? "—"} · {r.purpose}
                  </span>
                  <Badge variant={statusBadgeVariant(r.status)} className="text-xs shrink-0">
                    {REQUISITION_STATUS[r.status] ?? r.status}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
