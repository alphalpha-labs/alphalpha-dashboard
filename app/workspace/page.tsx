import { dashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

export default function WorkspacePage() {
  return <Dashboard data={dashboardData} initialTab="workspace" />;
}
