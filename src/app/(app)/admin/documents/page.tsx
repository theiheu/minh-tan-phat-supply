import { redirect } from "next/navigation";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import {
  adminGetAuditLogsAction,
  adminGetMasterDocumentsAction,
} from "@/features/admin-tools/actions";
import { MasterDocumentHub } from "@/features/admin-tools/components/master-document-hub";
import { requireProfile } from "@/lib/auth";
import { isOwner, isSuperuser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string; page?: string }>;
}) {
  const current = await requireProfile();
  if (!isSuperuser(current.role) && !isOwner(current.role)) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const kind = sp.kind || "all";
  const q = sp.q || "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [{ data: docs, total }, auditLogs] = await Promise.all([
    adminGetMasterDocumentsAction({ kind, q, page, pageSize: 50 }),
    adminGetAuditLogsAction(undefined, 30),
  ]);

  return (
    <div className="space-y-4">
      <SubnavTabs group="admin" userRole={current.role} />
      <MasterDocumentHub
        initialDocuments={docs}
        totalDocuments={total}
        initialAuditLogs={auditLogs}
      />
    </div>
  );
}
