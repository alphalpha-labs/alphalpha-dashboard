import { dashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
export default function InvestingPage() { return <Dashboard data={dashboardData} initialTab="investing" />; }
