"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Filter,
  History,
  Layers,
  Search,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { AdminDocTools } from "./admin-doc-tools";
import type { AdminDocumentListItem } from "../types";

const DOC_KIND_OPTIONS = [
  { value: "all", label: "Tất cả loại phiếu" },
  { value: "receipt", label: "Phiếu nhập kho (PNK)" },
  { value: "issue", label: "Phiếu xuất kho (PXK)" },
  { value: "requisition", label: "Phiếu yêu cầu (PYC)" },
  { value: "fuel_receipt", label: "Phiếu nhập dầu (PNNL)" },
  { value: "fuel_dispense", label: "Phiếu cấp dầu (PCNL)" },
  { value: "defect", label: "Phiếu báo hỏng (PBH)" },
  { value: "exchange", label: "Phiếu đổi hàng (PĐH)" },
  { value: "repair", label: "Phiếu sửa chữa (PSC)" },
  { value: "liquidation", label: "Phiếu thanh lý (PTL)" },
  { value: "stocktake", label: "Phiếu kiểm kê (PKK)" },
];

function getStatusBadge(status: string, label: string) {
  switch (status) {
    case "posted":
    case "completed":
    case "received":
      return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400 border-emerald-300">{label}</Badge>;
    case "approved":
    case "issued":
      return <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:text-blue-400 border-blue-300">{label}</Badge>;
    case "draft":
    case "pending":
    case "staging":
    case "in_repair":
      return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400 border-amber-300">{label}</Badge>;
    case "cancelled":
    case "rejected":
      return <Badge variant="destructive">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

interface MasterDocumentHubProps {
  initialDocuments: AdminDocumentListItem[];
  totalDocuments: number;
  initialAuditLogs: Array<{
    id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
    actor?: { name?: string; username?: string } | null;
    before?: unknown;
    after?: unknown;
  }>;
}

export function MasterDocumentHub({
  initialDocuments,
  totalDocuments,
  initialAuditLogs,
}: MasterDocumentHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentKind = searchParams.get("kind") || "all";
  const currentQ = searchParams.get("q") || "";

  const [kind, setKind] = useState(currentKind);
  const [search, setSearch] = useState(currentQ);
  const [, startTransition] = useTransition();

  const handleFilter = () => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (kind && kind !== "all") params.set("kind", kind);
      if (search.trim()) params.set("q", search.trim());
      router.push(`/admin/documents?${params.toString()}`);
    });
  };

  const handleClear = () => {
    setKind("all");
    setSearch("");
    router.push("/admin/documents");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="size-6 text-destructive" />
            Trung tâm Quản trị & Can thiệp Phiếu
          </h1>
          <p className="text-sm text-muted-foreground">
            Tra cứu, can thiệp trạng thái, mở lại sổ hoặc xoá cứng bất kỳ phiếu nào trong toàn hệ thống.
          </p>
        </div>
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents" className="flex items-center gap-1.5">
            <Layers className="size-4" />
            Danh sách tất cả phiếu ({totalDocuments})
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5">
            <History className="size-4" />
            Nhật ký can thiệp Admin ({initialAuditLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DANH SÁCH TẤT CẢ PHIẾU */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="size-4 text-primary" />
                Bộ lọc tìm kiếm phiếu
              </CardTitle>
              <CardDescription>
                Tìm kiếm theo mã phiếu, loại chứng từ hoặc lọc theo trạng thái.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn loại phiếu" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_KIND_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative space-y-1">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Nhập mã phiếu (VD: PXK, PNK, PYC...)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFilter()}
                    className="pl-8"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={handleFilter} className="flex-1">
                    Tìm kiếm
                  </Button>
                  <Button variant="outline" onClick={handleClear}>
                    Đặt lại
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Loại phiếu</TableHead>
                      <TableHead className="w-[180px]">Mã phiếu</TableHead>
                      <TableHead className="w-[130px]">Trạng thái</TableHead>
                      <TableHead>Đối tác / Khu vực</TableHead>
                      <TableHead>Người lập</TableHead>
                      <TableHead className="w-[140px]">Ngày lập</TableHead>
                      <TableHead className="text-right w-[180px]">Quyền Admin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialDocuments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          Không tìm thấy phiếu nào phù hợp với điều kiện tìm kiếm.
                        </TableCell>
                      </TableRow>
                    ) : (
                      initialDocuments.map((doc) => (
                        <TableRow key={`${doc.kind}-${doc.id}`}>
                          <TableCell className="font-medium text-xs">
                            <Badge variant="outline" className="font-normal">
                              {doc.kindLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono font-semibold text-sm">
                            {doc.code}
                          </TableCell>
                          <TableCell>{getStatusBadge(doc.status, doc.statusLabel)}</TableCell>
                          <TableCell className="text-sm">
                            {doc.zoneOrPartner || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {doc.creatorName || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(doc.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <AdminDocTools
                              kind={doc.kind}
                              id={doc.id}
                              code={doc.code}
                              docName={doc.kindLabel.toLowerCase()}
                              canReopen={doc.canReopen}
                              isAdmin={true}
                              compact={true}
                              initialCreatedAt={doc.createdAt}
                              initialNotes={doc.summary}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: NHẬT KÝ KIỂM TOÁN CAN THIỆP */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="size-4 text-primary" />
                Lịch sử can thiệp của Quản trị viên
              </CardTitle>
              <CardDescription>
                Lưu vết toàn bộ thao tác xoá cứng, mở lại phiếu hoặc can thiệp thông tin kèm Snapshot dữ liệu gốc.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Thời gian</TableHead>
                      <TableHead className="w-[140px]">Quản trị viên</TableHead>
                      <TableHead className="w-[150px]">Hành động</TableHead>
                      <TableHead className="w-[120px]">Phân hệ</TableHead>
                      <TableHead>Lý do & Chi tiết snapshot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialAuditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                          Chưa có nhật ký can thiệp nào của Admin.
                        </TableCell>
                      </TableRow>
                    ) : (
                      initialAuditLogs.map((log) => {
                        const beforeObj = log.before as Record<string, unknown> | null;
                        const reason = beforeObj?.reason as string | undefined;
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDateTime(log.created_at)}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {log.actor?.name || log.actor?.username || "Admin"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={log.action === "admin.hard_delete" ? "destructive" : "secondary"}
                                className="font-mono text-[11px]"
                              >
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs uppercase">
                              {log.entity_type || "N/A"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {reason ? (
                                <div className="font-medium text-foreground">
                                  Lý do: <span className="italic">{reason}</span>
                                </div>
                              ) : null}
                              <details className="mt-1 cursor-pointer text-muted-foreground hover:text-foreground">
                                <summary className="text-[11px]">Xem Snapshot JSON</summary>
                                <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-[10px]">
                                  {JSON.stringify({ before: log.before, after: log.after }, null, 2)}
                                </pre>
                              </details>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
