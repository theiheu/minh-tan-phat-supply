import { requireManager } from "@/lib/auth";
import { getCachedStockLocations } from "@/lib/cached-metadata";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, PackageMinus, PackagePlus } from "lucide-react";
import { AssemblyForm } from "@/features/assemblies/components/assembly-form";
import { DisassemblyForm } from "@/features/assemblies/components/disassembly-form";

export const dynamic = "force-dynamic";

export default async function AssembliesPage() {
  const profile = await requireManager();
  const rawLocations = await getCachedStockLocations();
  const locations = rawLocations.map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
  }));

  return (
    <div className="space-y-6">
      <SubnavTabs group="warehouse" userRole={profile.role} />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Layers className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Lắp ráp & Tháo dỡ thành phẩm</h1>
            <p className="text-xs text-muted-foreground">
              Quản lý quy trình lắp ráp bộ thành phẩm từ định mức BOM và tháo dỡ thu hồi/ghi nhận hư hỏng linh kiện.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="assembly" className="space-y-4">
        <div className="w-full max-w-md overflow-x-auto pb-1 scrollbar-none">
          <TabsList className="grid w-full grid-cols-2 min-w-[280px] h-10 p-1">
            <TabsTrigger value="assembly" className="text-xs sm:text-sm gap-2 shrink-0">
              <PackagePlus className="size-4" />
              <span>Lắp ráp thành phẩm</span>
            </TabsTrigger>
            <TabsTrigger value="disassembly" className="text-xs sm:text-sm gap-2 shrink-0">
              <PackageMinus className="size-4" />
              <span>Tháo dỡ bộ vật tư</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="assembly" className="space-y-4">
          <AssemblyForm locations={locations} />
        </TabsContent>

        <TabsContent value="disassembly" className="space-y-4">
          <DisassemblyForm locations={locations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
