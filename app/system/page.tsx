import { dashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
export default function SystemPage() { return <Dashboard data={dashboardData} initialTab="system" />; }
