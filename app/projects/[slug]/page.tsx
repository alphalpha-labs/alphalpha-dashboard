import { notFound } from "next/navigation";
import { dashboardData } from "@/lib/data";
import ProjectDetail, { findProjectBySlug } from "@/components/ProjectDetail";
import { slugify } from "@/lib/slugs";

export function generateStaticParams() {
  return dashboardData.projects.map(project => ({ slug: slugify(project.name) }));
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = findProjectBySlug(dashboardData, slug);
  if (!project) notFound();
  return <ProjectDetail data={dashboardData} project={project} />;
}
