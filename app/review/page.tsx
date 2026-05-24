import { dashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
export default function ReviewPage() { return <Dashboard data={dashboardData} initialTab="review" />; }
