import { dashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
export default function AutomationsPage() { return <Dashboard data={dashboardData} initialTab="automations" />; }
