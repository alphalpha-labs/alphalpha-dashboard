import Dashboard from "@/components/Dashboard";
import { dashboardData } from "@/lib/data";

export default function QueuesPage() {
  return <Dashboard data={dashboardData} initialTab="queues" />;
}
