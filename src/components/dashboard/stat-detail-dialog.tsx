"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import type { StatusBadgeVariant } from "@/lib/labels";
import { useUIStore } from "@/stores/ui-store";

export interface ModalDocumentItem {
  id: string;
  code: string;
  type: "requisition" | "receipt" | "exchange" | "liquidation" | "defect" | "issue";
  typeLabel: string;
  typeTone: StatusBadgeVariant;
  status: string;
  statusLabel: string;
  statusVariant: StatusBadgeVariant;
  href: string;
  createdAt: string;
  actorName?: string | null;
  zoneName?: string | null;
  purpose?: string | null;
}

export type StatModalType = "pending" | "issued" | "receipts" | null;

interface StatDetailDialogProps {
  type: StatModalType;
  onClose: () => void;
  items: ModalDocumentItem[];
}

const MODAL_CONFIG: Record<
  NonNullable<StatModalType>,
  { title: string; description: string; emptyText: string }
> = {
  pending: {
    title: "Danh sách phiếu đang chờ duyệt",
    description:
      "Tập hợp tất cả phiếu yêu cầu, đơn đặt hàng, đổi mới, thanh lý và báo hỏng đang chờ xử lý.",
    emptyText: "Không có phiếu nào đang ở trạng thái chờ duyệt.",
  },
  issued: {
    title: "Danh sách phiếu đã cấp chưa nhận",
    description:
      "Tập hợp các phiếu yêu cầu và phiếu đổi mới đã cấp phát nhưng người nhận chưa xác nhận.",
    emptyText: "Không có phiếu nào đang ở trạng thái đã cấp chưa nhận.",
  },
  receipts: {
    title: "Danh sách phiếu nhập kho đã ghi sổ",
    description: "Tập hợp các phiếu nhập hàng đã được xác nhận nhập vào tồn kho.",
    emptyText: "Không có phiếu nhập kho nào đã ghi sổ.",
  },
};

export function StatDetailDialog({ type, onClose, items }: StatDetailDialogProps) {
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const openSlipModal = useUIStore((s) => s.openSlipModal);

  function handleItemClick(item: ModalDocumentItem) {
    onClose();
    openSlipModal(item.type, item.id);
  }

  // Các loại phiếu có trong tập dữ liệu hiện tại
  const availableTypes = useMemo(() => {
    const map = new Map<string, { type: string; label: string; count: number }>();
    for (const item of items) {
      const current = map.get(item.type);
      if (current) {
        current.count += 1;
      } else {
        map.set(item.type, { type: item.type, label: item.typeLabel, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [items]);

  // Lọc dữ liệu theo tab và từ khóa tìm kiếm
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchTab = selectedTab === "all" || item.type === selectedTab;
      if (!matchTab) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.code.toLowerCase().includes(q) ||
        (item.actorName && item.actorName.toLowerCase().includes(q)) ||
        (item.zoneName && item.zoneName.toLowerCase().includes(q)) ||
        (item.purpose && item.purpose.toLowerCase().includes(q)) ||
        item.typeLabel.toLowerCase().includes(q) ||
        item.statusLabel.toLowerCase().includes(q)
      );
    });
  }, [items, selectedTab, searchQuery]);

  if (!type) return null;

  const config = MODAL_CONFIG[type];

  return (
    <Dialog open={Boolean(type)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl h-[90svh] max-h-[90svh] sm:h-auto sm:max-h-[88vh] flex flex-col p-4 sm:p-6 overflow-hidden border-2 border-border shadow-2xl rounded-2xl min-w-0">
        <DialogHeader className="shrink-0 pb-2 border-b pr-10 sm:pr-8 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold">{config.title}</DialogTitle>
              <Badge variant="neutral" className="font-mono text-xs">
                {items.length} phiếu
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar: Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {availableTypes.length > 1 ? (
            <Tabs
              value={selectedTab}
              onValueChange={setSelectedTab}
              className="w-full sm:w-auto"
            >
              <TabsList className="h-9 flex flex-wrap w-full sm:w-auto justify-start">
                <TabsTrigger value="all" className="text-xs">
                  Tất cả ({items.length})
                </TabsTrigger>
                {availableTypes.map((t) => (
                  <TabsTrigger key={t.type} value={t.type} className="text-xs">
                    {t.label} ({t.count})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <div />
          )}

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Tìm mã, người tạo, nội dung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 min-h-0 overflow-y-auto mt-2 min-h-[250px] max-h-[50vh] rounded-md border">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <p className="text-sm text-muted-foreground">
                {searchQuery.trim() ? "Không tìm thấy phiếu phù hợp với từ khóa." : config.emptyText}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[120px] text-xs">Mã phiếu</TableHead>
                      <TableHead className="w-[140px] text-xs">Loại phiếu</TableHead>
                      <TableHead className="w-[160px] text-xs">Người liên quan</TableHead>
                      <TableHead className="text-xs">Nội dung / Khu vực</TableHead>
                      <TableHead className="w-[140px] text-xs">Thời gian</TableHead>
                      <TableHead className="w-[110px] text-xs">Trạng thái</TableHead>
                      <TableHead className="w-[90px] text-right text-xs">Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={`${item.type}-${item.id}`} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => handleItemClick(item)}
                            className="text-primary hover:underline text-left"
                          >
                            {item.code}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.typeTone} className="text-xs">
                            {item.typeLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium text-foreground">
                            {item.actorName ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col">
                            <span className="truncate max-w-[240px]">
                              {item.purpose || "—"}
                            </span>
                            {item.zoneName && (
                              <span className="text-[11px] text-muted-foreground">
                                Khu: {item.zoneName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.statusVariant} className="text-xs">
                            {item.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleItemClick(item)}
                            className="h-8 px-2 text-xs"
                          >
                            Xem <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List View */}
              <div className="divide-y md:hidden">
                {filteredItems.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="p-3 space-y-2 hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={item.typeTone} className="text-[11px]">
                          {item.typeLabel}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => handleItemClick(item)}
                          className="font-mono text-xs font-bold text-primary hover:underline text-left"
                        >
                          {item.code}
                        </button>
                      </div>
                      <Badge variant={item.statusVariant} className="text-[11px]">
                        {item.statusLabel}
                      </Badge>
                    </div>

                    <div className="text-xs space-y-1">
                      {item.purpose && (
                        <p className="text-foreground line-clamp-2">{item.purpose}</p>
                      )}
                      <div className="flex flex-wrap items-center justify-between text-muted-foreground text-[11px] pt-1">
                        <span>
                          {item.actorName ? (
                            <>
                              Người: <span className="font-semibold text-foreground">{item.actorName}</span>
                            </>
                          ) : (
                            ""
                          )}
                        </span>
                        {item.zoneName && (
                          <span>
                            Khu: <span className="font-semibold text-foreground">{item.zoneName}</span>
                          </span>
                        )}
                        <span className="font-mono">{formatDateTime(item.createdAt)}</span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleItemClick(item)}
                        className="w-full h-7 text-xs justify-center"
                      >
                        Mở chi tiết phiếu <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
