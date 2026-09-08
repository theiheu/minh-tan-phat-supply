"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, PackageCheck, PackageOpen, Truck } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  ModalDocumentItem,
  StatDetailDialog,
  StatModalType,
} from "@/components/dashboard/stat-detail-dialog";

export interface DashboardStatsData {
  totalProducts: number;
  pendingCount: number;
  pendingItems: ModalDocumentItem[];
  issuedCount: number;
  issuedItems: ModalDocumentItem[];
  receiptsCount: number;
  receiptsItems: ModalDocumentItem[];
}

export function DashboardStatsSection({ data }: { data: DashboardStatsData }) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<StatModalType>(null);

  const getModalItems = (): ModalDocumentItem[] => {
    if (activeModal === "pending") return data.pendingItems;
    if (activeModal === "issued") return data.issuedItems;
    if (activeModal === "receipts") return data.receiptsItems;
    return [];
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <StatCard
          icon={PackageOpen}
          label="Tổng vật tư"
          value={data.totalProducts}
          tone="sky"
          hint="Xem danh mục vật tư"
          onClick={() => router.push("/products")}
        />
        <StatCard
          icon={ClipboardList}
          label="Phiếu đang chờ"
          value={data.pendingCount}
          tone="amber"
          hint="Nhấn xem tất cả phiếu chờ duyệt"
          onClick={() => setActiveModal("pending")}
        />
        <StatCard
          icon={Truck}
          label="Đã cấp chưa nhận"
          value={data.issuedCount}
          tone="orange"
          hint="Nhấn xem phiếu chờ nhận"
          onClick={() => setActiveModal("issued")}
        />
        <StatCard
          icon={PackageCheck}
          label="Phiếu nhập đã ghi"
          value={data.receiptsCount}
          tone="emerald"
          hint="Nhấn xem phiếu đã nhập kho"
          onClick={() => setActiveModal("receipts")}
        />
      </div>

      <StatDetailDialog
        type={activeModal}
        onClose={() => setActiveModal(null)}
        items={getModalItems()}
      />
    </>
  );
}
