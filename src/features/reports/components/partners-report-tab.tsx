"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Users,
  DollarSign,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Phone,
  Store,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatVnd } from "@/lib/format";
import type { PartnersReportData } from "../types";

export interface PartnersReportTabProps {
  data: PartnersReportData | null;
  isLoading?: boolean;
}

export function PartnersReportTab({
  data,
  isLoading = false,
}: PartnersReportTabProps) {
  const [activeTab, setActiveTab] = useState<"suppliers" | "customers">("suppliers");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  // 1. Suppliers Calculations
  const totalSupplierAmount = useMemo(() => {
    if (!data?.suppliers) return 0;
    return data.suppliers.reduce((sum, s) => sum + s.totalAmount, 0);
  }, [data?.suppliers]);

  const activeSuppliersCount = useMemo(() => {
    if (!data?.suppliers) return 0;
    return data.suppliers.filter(
      (s) => s.receiptCount > 0 || s.totalAmount > 0
    ).length;
  }, [data?.suppliers]);

  const totalSupplierReceipts = useMemo(() => {
    if (!data?.suppliers) return 0;
    return data.suppliers.reduce((sum, s) => sum + s.receiptCount, 0);
  }, [data?.suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!data?.suppliers) return [];
    const term = supplierSearch.trim().toLowerCase();
    if (!term) return data.suppliers;

    return data.suppliers.filter(
      (s) =>
        s.supplierName.toLowerCase().includes(term) ||
        (s.phone && s.phone.toLowerCase().includes(term))
    );
  }, [data?.suppliers, supplierSearch]);

  const supplierTotals = useMemo(() => {
    return filteredSuppliers.reduce(
      (acc, s) => {
        acc.receiptCount += s.receiptCount;
        acc.totalQuantity += s.totalQuantity;
        acc.totalAmount += s.totalAmount;
        return acc;
      },
      {
        receiptCount: 0,
        totalQuantity: 0,
        totalAmount: 0,
      }
    );
  }, [filteredSuppliers]);

  // 2. Customers Calculations
  const totalCustomerRevenue = useMemo(() => {
    if (!data?.customers) return 0;
    return data.customers.reduce((sum, c) => sum + c.totalRevenue, 0);
  }, [data?.customers]);

  const activeCustomersCount = useMemo(() => {
    if (!data?.customers) return 0;
    return data.customers.filter(
      (c) => c.issueCount > 0 || c.totalRevenue > 0
    ).length;
  }, [data?.customers]);

  const totalCustomerIssues = useMemo(() => {
    if (!data?.customers) return 0;
    return data.customers.reduce((sum, c) => sum + c.issueCount, 0);
  }, [data?.customers]);

  const filteredCustomers = useMemo(() => {
    if (!data?.customers) return [];
    const term = customerSearch.trim().toLowerCase();
    if (!term) return data.customers;

    return data.customers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(term) ||
        (c.phone && c.phone.toLowerCase().includes(term))
    );
  }, [data?.customers, customerSearch]);

  const customerTotals = useMemo(() => {
    return filteredCustomers.reduce(
      (acc, c) => {
        acc.issueCount += c.issueCount;
        acc.totalQuantity += c.totalQuantity;
        acc.totalRevenue += c.totalRevenue;
        return acc;
      },
      {
        issueCount: 0,
        totalQuantity: 0,
        totalRevenue: 0,
      }
    );
  }, [filteredCustomers]);

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "suppliers" | "customers")}
        className="space-y-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger
              value="suppliers"
              onClick={() => setActiveTab("suppliers")}
              className="gap-2"
            >
              <Building2 className="size-4" aria-hidden="true" />
              <span>Nhà cung cấp</span>
              {!isLoading && data?.suppliers && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-[11px] font-mono"
                >
                  {data.suppliers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              onClick={() => setActiveTab("customers")}
              className="gap-2"
            >
              <Users className="size-4" aria-hidden="true" />
              <span>Khách hàng & Thương lái</span>
              {!isLoading && data?.customers && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-[11px] font-mono"
                >
                  {data.customers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ----------------- SUBTAB 1: NHÀ CUNG CẤP (SUPPLIERS) ----------------- */}
        <TabsContent value="suppliers" className="space-y-6">
          {/* Supplier KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* KPI 1: Tổng tiền nhập từ NCC */}
            <Card className="p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tổng tiền nhập từ NCC
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <DollarSign className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-32" />
                ) : (
                  <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatVnd(totalSupplierAmount)}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Tổng giá trị vật tư đã nhập từ các nhà cung cấp
                </p>
              </div>
            </Card>

            {/* KPI 2: Số NCC đã giao hàng */}
            <Card className="p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Số NCC đã giao hàng
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Building2 className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : (
                  <div className="text-xl font-bold tracking-tight text-foreground font-mono">
                    {formatNumber(activeSuppliersCount)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      NCC
                    </span>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Nhà cung cấp có phát sinh đơn nhập trong kỳ
                </p>
              </div>
            </Card>

            {/* KPI 3: Tổng số đơn nhập */}
            <Card className="p-4 shadow-xs sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tổng số đơn nhập
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : (
                  <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
                    {formatNumber(totalSupplierReceipts)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      đơn
                    </span>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Phiếu nhập kho đã hoàn tất trong kỳ
                </p>
              </div>
            </Card>
          </div>

          {/* Supplier Table */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Store className="size-4 text-primary" aria-hidden="true" />
                    <CardTitle className="text-base font-semibold">
                      Bảng Tổng Hợp Nhập Hàng Theo Nhà Cung Cấp
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Thống kê số lượng đơn, sản lượng và tổng tiền nhập từ từng đối tác cung cấp
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search
                    className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    placeholder="Tìm kiếm NCC theo tên, SĐT..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                    aria-label="Tìm kiếm nhà cung cấp"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Tên nhà cung cấp</TableHead>
                    <TableHead className="w-[140px]">Số điện thoại</TableHead>
                    <TableHead className="w-[120px] text-right">Số đơn nhập</TableHead>
                    <TableHead className="w-[130px] text-right">Tổng SL hàng</TableHead>
                    <TableHead className="w-[160px] text-right">Tổng tiền hàng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-12" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-16" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-24" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-xs text-muted-foreground"
                      >
                        {supplierSearch
                          ? `Không tìm thấy nhà cung cấp nào khớp với từ khóa "${supplierSearch}".`
                          : "Chưa có dữ liệu nhà cung cấp trong kỳ này."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((row) => (
                      <TableRow key={row.supplierId}>
                        <TableCell className="py-3 font-medium text-foreground">
                          {row.supplierName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {row.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="size-3 text-muted-foreground" aria-hidden="true" />
                              {row.phone}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatNumber(row.receiptCount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatNumber(row.totalQuantity)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatVnd(row.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!isLoading && filteredSuppliers.length > 0 && (
                  <TableFooter>
                    <TableRow className="border-t bg-muted/50 font-bold hover:bg-muted/50">
                      <TableCell colSpan={2} className="text-left font-semibold">
                        Tổng cộng ({formatNumber(filteredSuppliers.length)} NCC):
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {formatNumber(supplierTotals.receiptCount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {formatNumber(supplierTotals.totalQuantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatVnd(supplierTotals.totalAmount)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------- SUBTAB 2: KHÁCH HÀNG (CUSTOMERS) ----------------- */}
        <TabsContent value="customers" className="space-y-6">
          {/* Customer KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* KPI 1: Tổng doanh số bán ra */}
            <Card className="p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tổng doanh số bán ra
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
                  <DollarSign className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-32" />
                ) : (
                  <div className="text-xl font-bold tracking-tight text-violet-600 dark:text-violet-400 font-mono">
                    {formatVnd(totalCustomerRevenue)}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Doanh thu xuất bán vật tư & thanh lý cho khách
                </p>
              </div>
            </Card>

            {/* KPI 2: Số khách hàng phát sinh */}
            <Card className="p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Số khách hàng phát sinh
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Users className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : (
                  <div className="text-xl font-bold tracking-tight text-foreground font-mono">
                    {formatNumber(activeCustomersCount)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      khách hàng
                    </span>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Khách hàng / thương lái có phát sinh đơn xuất
                </p>
              </div>
            </Card>

            {/* KPI 3: Tổng số đơn xuất bán */}
            <Card className="p-4 shadow-xs sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tổng số đơn xuất bán
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                  <ArrowUpFromLine className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : (
                  <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
                    {formatNumber(totalCustomerIssues)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      đơn
                    </span>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Phiếu xuất kho cho khách hàng trong kỳ
                </p>
              </div>
            </Card>
          </div>

          {/* Customer Table */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary" aria-hidden="true" />
                    <CardTitle className="text-base font-semibold">
                      Bảng Tổng Hợp Doanh Thu Theo Khách Hàng / Thương Lái
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Thống kê số lượng đơn xuất, sản lượng và doanh thu thu về từ từng khách hàng
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search
                    className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    placeholder="Tìm kiếm khách hàng theo tên, SĐT..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                    aria-label="Tìm kiếm khách hàng"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Tên khách hàng / Thương lái</TableHead>
                    <TableHead className="w-[140px]">Số điện thoại</TableHead>
                    <TableHead className="w-[130px] text-right">Số đơn xuất bán</TableHead>
                    <TableHead className="w-[130px] text-right">Tổng SL hàng</TableHead>
                    <TableHead className="w-[160px] text-right">Doanh thu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-12" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-16" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-24" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-xs text-muted-foreground"
                      >
                        {customerSearch
                          ? `Không tìm thấy khách hàng nào khớp với từ khóa "${customerSearch}".`
                          : "Chưa có dữ liệu khách hàng trong kỳ này."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((row) => (
                      <TableRow key={row.customerId}>
                        <TableCell className="py-3 font-medium text-foreground">
                          {row.customerName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {row.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="size-3 text-muted-foreground" aria-hidden="true" />
                              {row.phone}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatNumber(row.issueCount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatNumber(row.totalQuantity)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-violet-600 dark:text-violet-400">
                          {formatVnd(row.totalRevenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!isLoading && filteredCustomers.length > 0 && (
                  <TableFooter>
                    <TableRow className="border-t bg-muted/50 font-bold hover:bg-muted/50">
                      <TableCell colSpan={2} className="text-left font-semibold">
                        Tổng cộng ({formatNumber(filteredCustomers.length)} khách hàng):
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {formatNumber(customerTotals.issueCount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {formatNumber(customerTotals.totalQuantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-violet-600 dark:text-violet-400">
                        {formatVnd(customerTotals.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
