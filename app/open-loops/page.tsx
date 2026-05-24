import { dashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
export default function OpenLoopsPage() { return <Dashboard data={dashboardData} initialTab="loops" />; }
