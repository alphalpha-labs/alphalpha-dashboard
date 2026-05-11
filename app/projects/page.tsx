import { dashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
export default function ProjectsPage() { return <Dashboard data={dashboardData} initialTab="projects" />; }
