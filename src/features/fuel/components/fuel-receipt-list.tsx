"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ZoomableImage } from "@/components/image-lightbox";
import { formatDate, formatDateTime, formatVnd } from "@/lib/format";
import { formatFuelLiters } from "@/lib/fuel";
import { cancelFuelReceiptAction } from "../actions";
import type { FuelReceipt, FuelType } from "../types";
import { FuelReceiptDialog } from "./fuel-receipt-dialog";

export interface FuelReceiptRow extends FuelReceipt {
  fuel_type?: { name: string; code: string; unit: string } | null;
  supplier?: { name: string } | null;
  receiver?: { name: string } | null;
}

export function FuelReceiptList({
  receipts,
  total,
  page,
  pageSize,
  fuelTypes,
  suppliers,
  filters,
}: {
  receipts: FuelReceiptRow[];
  total: number;
  page: number;
  pageSize: number;
  fuelTypes: FuelType[];
  suppliers: { id: string; name: string }[];
  filters: { from: string; to: string; fuelTypeId: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleCancel(id: string, code: string) {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy phiếu nhập dầu ${code}? Tồn kho sẽ được trừ lại.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await cancelFuelReceiptAction(id);
        toast.success(`Đã hủy phiếu nhập dầu ${code} và cập nhật lại tồn kho`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Lỗi khi hủy phiếu");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Nhập kho dầu (Từ NCC)</h2>
          <p className="text-sm text-muted-foreground">
            Quản lý các đợt nhập dầu từ nhà cung cấp, hóa đơn GTGT và giá nhập.
          </p>
        </div>
        <FuelReceiptDialog
          fuelTypes={fuelTypes}
          suppliers={suppliers}
          onSaved={() => router.refresh()}
        />
      </div>

      <ListFilters
        basePath="/fuel"
        title="Lọc phiếu nhập"
        showDateRange
        filters={[
          {
            param: "fuelTypeId",
            label: "Loại dầu",
            allLabel: "Tất cả loại dầu",
            options: fuelTypes.map((ft) => ({ value: ft.id, label: ft.name })),
          },
        ]}
        initial={{
          tab: "receipts",
          from: filters.from,
          to: filters.to,
          fuelTypeId: filters.fuelTypeId,
        }}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Danh sách phiếu nhập dầu ({total} phiếu)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Mã phiếu</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead>Loại nhiên liệu</TableHead>
                  <TableHead className="text-right">Số lít nhập</TableHead>
                  <TableHead className="text-right">Đơn giá / Lít</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead>Số HĐ / Chứng từ</TableHead>
                  <TableHead className="text-center">Ảnh</TableHead>
                  <TableHead>Người nhận</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                      Không có phiếu nhập kho nào trong khoảng thời gian này.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((r) => {
                    const pdfUrl = `/api/fuel/receipts/${r.id}/pdf`;
                    const images = r.invoice_images ?? [];

                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono font-medium text-xs">
                          {r.code}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(r.created_at)}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {r.supplier?.name ?? "Mua ngoài"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.fuel_type?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm text-primary">
                          {formatFuelLiters(Number(r.quantity))}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {formatVnd(Number(r.unit_price))}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-xs text-blue-600">
                          {formatVnd(Number(r.total_amount))}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {r.invoice_number ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {images.length > 0 ? (
                            <ZoomableImage
                              src={images[0]}
                              images={images}
                              alt="Hóa đơn"
                              className="size-8 mx-auto rounded object-cover border"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.receiver?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild size="icon" variant="ghost" className="size-8" title="In phiếu">
                              <a href={pdfUrl} target="_blank" rel="noreferrer">
                                <Printer className="size-4" />
                              </a>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:bg-destructive/10"
                              title="Hủy phiếu"
                              onClick={() => handleCancel(r.id, r.code)}
                              disabled={pending}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
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

      <Pagination
        basePath="/fuel"
        page={page}
        totalPages={totalPages}
        params={{
          tab: "receipts",
          from: filters.from || null,
          to: filters.to || null,
          fuelTypeId: filters.fuelTypeId || null,
        }}
      />
    </div>
  );
}
