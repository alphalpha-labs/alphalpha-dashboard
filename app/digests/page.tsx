import { dashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
export default function DigestsPage() { return <Dashboard data={dashboardData} initialTab="digests" />; }
