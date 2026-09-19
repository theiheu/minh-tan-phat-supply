import { requireProfile } from "@/lib/auth";
import {
  getAccountantDashboardData,
  getDriverDashboardData,
  getExecutiveDashboardData,
  getRequesterDashboardData,
  getTechnicianDashboardData,
  getWarehouseDashboardData,
} from "@/features/dashboard/server/get-role-dashboard-data";
import { ExecutiveDashboardView } from "@/components/dashboard/views/executive-dashboard-view";
import { AccountantDashboardView } from "@/components/dashboard/views/accountant-dashboard-view";
import { WarehouseDashboardView } from "@/components/dashboard/views/warehouse-dashboard-view";
import { TechnicianDashboardView } from "@/components/dashboard/views/technician-dashboard-view";
import { RequesterDashboardView } from "@/components/dashboard/views/requester-dashboard-view";
import { DriverDashboardView } from "@/components/dashboard/views/driver-dashboard-view";

export default async function DashboardPage() {
  const profile = await requireProfile();

  switch (profile.role) {
    case "driver": {
      const data = await getDriverDashboardData(profile);
      return <DriverDashboardView profile={profile} data={data} />;
    }
    case "requester": {
      const data = await getRequesterDashboardData(profile);
      return <RequesterDashboardView profile={profile} data={data} />;
    }
    case "technician": {
      const data = await getTechnicianDashboardData(profile);
      return <TechnicianDashboardView profile={profile} data={data} />;
    }
    case "warehouse": {
      const data = await getWarehouseDashboardData(profile);
      return <WarehouseDashboardView profile={profile} data={data} />;
    }
    case "accountant": {
      const data = await getAccountantDashboardData(profile);
      return <AccountantDashboardView profile={profile} data={data} />;
    }
    case "owner":
    case "superuser":
    default: {
      const data = await getExecutiveDashboardData(profile);
      return <ExecutiveDashboardView profile={profile} data={data} />;
    }
  }
}
