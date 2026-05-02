import { dashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return <Dashboard data={dashboardData} />;
}
