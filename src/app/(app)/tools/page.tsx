import Link from "next/link";
import { AlertTriangle, Clock, History, User, Wrench } from "lucide-react";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { formatZoneLabel } from "@/lib/format-zone";
import { ToolBorrowDialog, type ToolBorrowVariantOption } from "@/features/tools/components/tool-borrow-dialog";
import { ToolCard } from "@/features/tools/components/tool-card";
import { requireProfile } from "@/lib/auth";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { isPrivileged } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    zone?: string;
    overdue?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const isManager = isPrivileged(profile.role);
  const supabase = await createClient();

  const activeTab =
    sp.tab === "my_tools" || sp.tab === "all_borrowed" || sp.tab === "history"
      ? sp.tab === "all_borrowed" && !isManager
        ? "my_tools"
        : sp.tab
      : isManager
        ? "all_borrowed"
        : "my_tools";

  const zone = sp.zone ?? null;
  const overdue = sp.overdue ?? null;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Fetch form options (variants, stock, zones, sub_zones, profiles for manager)
  const [
    { data: variantsData },
    { data: stockData },
    { data: zonesData },
    { data: subZonesData },
    { data: profilesData },
  ] = await Promise.all([
    supabase
      .from("variants")
      .select("id, attributes, unit, products(name, code, image_url)")
      .order("id"),
    supabase.from("variant_stock").select("variant_id, quantity"),
    supabase.from("zones").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("sub_zones").select("id, zone_id, name").is("deleted_at", null).order("display_order"),
    isManager
      ? supabase.from("profiles").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: null }),
  ]);

  const stockMap = new Map((stockData ?? []).map((s) => [s.variant_id, s.quantity ?? 0]));

  const toolVariants: ToolBorrowVariantOption[] = (variantsData ?? []).map((v) => {
    const product = v.products as { name?: string; code?: string; image_url?: string } | null;
    return {
      id: v.id,
      name: product?.name ?? "Dụng cụ / Vật tư",
      detail: variantLabel(v.attributes, v.unit),
      unit: v.unit ?? "cái",
      availableStock: stockMap.get(v.id) ?? 0,
    };
  });

  const zones = (zonesData ?? []).map((z) => ({
    id: z.id,
    name: z.name,
  }));

  const subZones = (subZonesData ?? []).map((s) => ({
    id: s.id,
    zone_id: s.zone_id,
    name: s.name,
  }));

  const borrowers = (profilesData ?? []).map((p) => ({
    id: p.id,
    fullName: p.name,
  }));

  // 2. Fetch tab counts
  const [
    { count: myToolsCount },
    allBorrowedResult,
    overdueResult,
    historyResult,
  ] = await Promise.all([
    supabase
      .from("tool_borrowings")
      .select("id", { count: "exact", head: true })
      .eq("borrower_id", profile.id)
      .eq("status", "borrowed"),
    isManager
      ? supabase
          .from("tool_borrowings")
          .select("id", { count: "exact", head: true })
          .eq("status", "borrowed")
      : Promise.resolve({ count: 0 }),
    isManager
      ? supabase
          .from("tool_borrowings")
          .select("id", { count: "exact", head: true })
          .eq("status", "borrowed")
          .lt("expected_return_date", todayStr)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("tool_borrowings")
      .select("id", { count: "exact", head: true })
      .in("status", ["returned", "cancelled"])
      .match(isManager ? {} : { borrower_id: profile.id }),
  ]);

  const overdueCount = overdueResult.count ?? 0;

  // 3. Build main query
  let query = supabase
    .from("tool_borrowings")
    .select(
      `
      id,
      code,
      borrower_id,
      zone_id,
      purpose,
      borrowed_at,
      expected_return_date,
      returned_at,
      issued_by,
      received_back_by,
      notes,
      status,
      created_at,
      updated_at,
      borrower:profiles!tool_borrowings_borrower_id_fkey(name),
      zone:zones!tool_borrowings_zone_id_fkey(name),
      sub_zone:sub_zones!tool_borrowings_sub_zone_id_fkey(name),
      issued_by_profile:profiles!tool_borrowings_issued_by_fkey(name),
      tool_borrowing_items(
        id,
        variant_id,
        quantity,
        returned_quantity,
        notes,
        variants(attributes, unit, products(name, image_url))
      )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (activeTab === "my_tools") {
    query = query.eq("borrower_id", profile.id).eq("status", "borrowed");
    if (zone) query = query.eq("zone_id", zone);
  } else if (activeTab === "all_borrowed") {
    query = query.eq("status", "borrowed");
    if (zone) query = query.eq("zone_id", zone);
    if (overdue === "true") query = query.lt("expected_return_date", todayStr);
  } else if (activeTab === "history") {
    if (!isManager) {
      query = query.eq("borrower_id", profile.id);
    }
    query = query.in("status", ["returned", "cancelled"]);
    if (zone) query = query.eq("zone_id", zone);
  }

  if (q) {
    query = query.or(`code.ilike.%${q}%,purpose.ilike.%${q}%`);
  }

  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data: borrowings, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const zoneOptions = zones.map((z) => ({ value: z.id, label: z.name }));

  const tabs = [
    {
      id: "my_tools",
      label: "Dụng cụ tôi đang giữ",
      icon: User,
      count: myToolsCount ?? 0,
    },
    ...(isManager
      ? [
          {
            id: "all_borrowed",
            label: "Đang cho mượn (Toàn trại)",
            icon: Clock,
            count: allBorrowedResult.count ?? 0,
            overdueAlert: overdueCount > 0 ? overdueCount : 0,
          },
        ]
      : []),
    {
      id: "history",
      label: "Lịch sử mượn trả",
      icon: History,
      count: historyResult.count ?? 0,
    },
  ];

  return (
    <div className="space-y-4">
      <SubnavTabs group="requisitions" userRole={profile?.role} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="size-5 text-primary" />
            Quản lý mượn & trả dụng cụ
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Theo dõi dụng cụ mượn dùng chung, thời hạn hoàn trả và xuất phiếu mượn.
          </p>
        </div>

        <ToolBorrowDialog
          variants={toolVariants}
          zones={zones}
          subZones={subZones}
          borrowers={borrowers}
          isManager={isManager}
          defaultZoneId={profile?.zone_id ?? undefined}
          defaultSubZoneId={undefined}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const href = `/tools?tab=${tab.id}${zone ? `&zone=${encodeURIComponent(zone)}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
              {tab.overdueAlert ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    isActive
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-destructive/15 text-destructive",
                  )}
                  title={`${tab.overdueAlert} dụng cụ quá hạn trả`}
                >
                  <AlertTriangle className="size-3" />
                  {tab.overdueAlert} quá hạn
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* Filters */}
      <ListFilters
        basePath="/tools"
        searchPlaceholder="Tìm theo mã phiếu, mục đích mượn…"
        title="Lọc dụng cụ"
        filters={[
          { param: "zone", label: "Khu vực", options: zoneOptions },
          ...(isManager && activeTab === "all_borrowed"
            ? [
                {
                  param: "overdue",
                  label: "Tình trạng hạn",
                  options: [{ value: "true", label: "⚠️ Quá hạn trả" }],
                },
              ]
            : []),
        ]}
        initial={{
          q,
          zone: zone ?? "",
          overdue: overdue ?? "",
          tab: activeTab,
        }}
      />

      {/* Items list / cards */}
      {(!borrowings || borrowings.length === 0) ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-12 text-center bg-card/40">
          <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Wrench className="size-7" />
          </div>
          <h3 className="text-base font-semibold">Không tìm thấy dụng cụ nào</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {activeTab === "my_tools"
              ? "Bạn hiện không giữ dụng cụ nào. Hãy bấm \"Mượn dụng cụ\" để tạo phiếu mới khi cần."
              : activeTab === "all_borrowed"
                ? "Hiện không có dụng cụ nào đang được mượn trên toàn trại."
                : "Chưa có lịch sử mượn trả dụng cụ nào."}
          </p>
          <div className="mt-5">
            <ToolBorrowDialog
              variants={toolVariants}
              zones={zones}
              subZones={subZones}
              borrowers={borrowers}
              isManager={isManager}
              defaultZoneId={profile?.zone_id ?? undefined}
              defaultSubZoneId={undefined}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {borrowings.flatMap((b) => {
            const borrowerName = (b.borrower as { name?: string } | null)?.name ?? null;
            const zoneName = formatZoneLabel(
              (b.zone as { name?: string } | null)?.name,
              (b.sub_zone as { name?: string } | null)?.name
            );
            const issuedByName = (b.issued_by_profile as { name?: string } | null)?.name ?? null;
            const items = b.tool_borrowing_items ?? [];

            if (items.length === 0) {
              return [
                <ToolCard
                  key={b.id}
                  borrowingId={b.id}
                  code={b.code}
                  productName="Dụng cụ"
                  quantity={1}
                  returnedQuantity={b.status === "returned" ? 1 : 0}
                  borrowedAt={b.borrowed_at}
                  expectedReturnDate={b.expected_return_date}
                  returnedAt={b.returned_at}
                  purpose={b.purpose}
                  borrowerName={borrowerName}
                  zoneName={zoneName}
                  issuedByName={issuedByName}
                  isManager={isManager}
                  status={b.status}
                />,
              ];
            }

            return items.map((item) => {
              const variant = item.variants as {
                attributes?: unknown;
                unit?: string | null;
                products?: { name?: string; image_url?: string | null } | null;
              } | null;

              const productName = variant?.products?.name ?? "Dụng cụ";
              const variantLbl = variantLabel(variant?.attributes, variant?.unit);

              return (
                <ToolCard
                  key={item.id}
                  borrowingId={b.id}
                  code={b.code}
                  variantId={item.variant_id}
                  productName={productName}
                  variantLabel={variantLbl}
                  unit={variant?.unit}
                  imageUrl={variant?.products?.image_url}
                  quantity={item.quantity}
                  returnedQuantity={item.returned_quantity}
                  borrowedAt={b.borrowed_at}
                  expectedReturnDate={b.expected_return_date}
                  returnedAt={b.returned_at}
                  purpose={b.purpose}
                  borrowerName={borrowerName}
                  zoneName={zoneName}
                  issuedByName={issuedByName}
                  isManager={isManager}
                  status={b.status}
                />
              );
            });
          })}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        basePath="/tools"
        page={page}
        totalPages={totalPages}
        params={{
          tab: activeTab,
          zone: zone ?? undefined,
          overdue: overdue ?? undefined,
          q: q || undefined,
        }}
      />
    </div>
  );
}
