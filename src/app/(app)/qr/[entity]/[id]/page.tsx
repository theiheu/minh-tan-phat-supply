import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { QrPrintStudio } from "@/features/pdf/components/qr-print-studio";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface QrEntityConfig {
  pagePath: (id: string) => string;
  title: string;
  backHref: (id: string) => string;
}

const QR_ENTITIES: Record<string, QrEntityConfig> = {
  requisition: {
    pagePath: (id) => `/requisitions/${id}`,
    title: "PHIẾU YÊU CẦU VẬT TƯ",
    backHref: (id) => `/requisitions/${id}`,
  },
  receipt: {
    pagePath: (id) => `/receipts/${id}`,
    title: "PHIẾU ĐẶT HÀNG & NHẬP KHO",
    backHref: (id) => `/receipts/${id}`,
  },
  issue: {
    pagePath: (id) => `/issues/${id}`,
    title: "PHIẾU XUẤT KHO",
    backHref: (id) => `/issues/${id}`,
  },
  defect: {
    pagePath: () => "/defects",
    title: "PHIẾU BÁO HỎNG",
    backHref: () => "/defects",
  },
  repair: {
    pagePath: () => "/repairs",
    title: "PHIẾU SỬA CHỮA",
    backHref: () => "/repairs",
  },
  liquidation: {
    pagePath: () => "/liquidations",
    title: "PHIẾU THANH LÝ",
    backHref: () => "/liquidations",
  },
  stocktake: {
    pagePath: () => "/stocktake",
    title: "PHIẾU KIỂM KÊ",
    backHref: () => "/stocktake",
  },
};

/** Lấy mã phiếu theo loại — mọi bảng đều có cột `code`. */
async function fetchSlipCode(entity: string, id: string): Promise<{ code: string } | null> {
  const supabase = await createClient();
  switch (entity) {
    case "requisition":
      return (await supabase.from("requisitions").select("code").eq("id", id).single()).data;
    case "receipt":
      return (await supabase.from("receipts").select("code").eq("id", id).single()).data;
    case "issue":
      return (await supabase.from("issues").select("code").eq("id", id).single()).data;
    case "defect":
      return (await supabase.from("defect_notes").select("code").eq("id", id).single()).data;
    case "repair":
      return (await supabase.from("repair_orders").select("code").eq("id", id).single()).data;
    case "liquidation":
      return (await supabase.from("liquidation_notes").select("code").eq("id", id).single()).data;
    case "stocktake":
      return (await supabase.from("stocktake_sessions").select("code").eq("id", id).single()).data;
    default:
      return null;
  }
}

export default async function QrPrintPage({
  params,
}: {
  params: Promise<{ entity: string; id: string }>;
}) {
  const { entity, id } = await params;
  const config = QR_ENTITIES[entity];
  if (!config) notFound();

  await getCurrentProfile();

  const row = await fetchSlipCode(entity, id);
  if (!row) notFound();

  // Xây dựng dummy request để lấy origin URL đầy đủ cho mã QR
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") || "http";
  const dummyReq = new Request(`${proto}://${host}/qr/${entity}/${id}`);

  const qrDataUri = await generateQrDataUri(getSlipUrl(dummyReq, config.pagePath(id)), 512);

  return (
    <QrPrintStudio
      entity={entity}
      id={id}
      code={row.code}
      title={config.title}
      qrDataUri={qrDataUri}
      backHref={config.backHref(id)}
    />
  );
}
