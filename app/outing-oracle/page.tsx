import Dashboard from "@/components/Dashboard";
import { dashboardData } from "@/lib/data";

export default function OutingOraclePage() {
  return <Dashboard data={dashboardData} initialTab="outing-oracle" />;
}
