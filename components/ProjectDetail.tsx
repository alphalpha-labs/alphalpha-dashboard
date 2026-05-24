import Link from "next/link";
import type { DashboardData, Project } from "@/lib/data";
import { slugify } from "@/lib/slugs";

export default function ProjectDetail({ data, project }: { data: DashboardData; project: Project }) {
  const projectLoops = data.openLoops.filter(loop => {
    const haystack = `${loop.project} ${loop.text}`.toLowerCase();
    const name = project.name.toLowerCase().split(/[\/—-]/)[0].trim();
    return haystack.includes(name) || loop.project === project.name || project.loops?.some(pl => pl.text === loop.text);
  });
  const relatedAutomations = (data.automations || []).filter(job => {
    const text = `${job.name} ${job.description} ${job.category}`.toLowerCase();
    return text.includes(project.name.toLowerCase().split(/[\/—-]/)[0].trim()) || text.includes(project.category.toLowerCase().split(/\s+/)[0]);
  });
  const relatedDigests = data.digests.filter(digest => `${digest.title} ${digest.summary} ${digest.category}`.toLowerCase().includes(project.name.toLowerCase().split(/[\/—-]/)[0].trim())).slice(0, 6);

  return (
    <div className="projectDetailPage">
      <Link href="/projects" className="detailBack">← Projects</Link>
      <div className="projectDetailHero">
        <div>
          <span className="projectCategory">{project.category}</span>
          <h1 className="projectDetailTitle">{project.name}</h1>
          <p className="projectDetailSummary">{project.summary}</p>
        </div>
        <div className="projectDetailFacts">
          <span>{project.status}</span>
          <span>{project.ocOwned ? "OpenClaw managed" : "Manually tracked"}</span>
          <span>Last: {project.lastActivity}</span>
        </div>
      </div>

      <div className="projectDetailGrid">
        <section className="detailPanel">
          <h2>Open loops</h2>
          {projectLoops.length ? projectLoops.map(loop => (
            <div key={loop.id} className="detailLoop"><strong>{loop.priority}</strong><span>{loop.text}</span></div>
          )) : <p>No directly linked loops.</p>}
        </section>
        <section className="detailPanel">
          <h2>Automations</h2>
          {relatedAutomations.length ? relatedAutomations.slice(0, 6).map(job => (
            <div key={job.id} className="detailLoop"><strong>{job.enabled ? "ON" : "OFF"}</strong><span>{job.name} · {job.scheduleLabel}</span></div>
          )) : <p>No directly linked automations.</p>}
        </section>
        <section className="detailPanel">
          <h2>Recent source notes</h2>
          {relatedDigests.length ? relatedDigests.map(digest => (
            <div key={digest.id} className="detailLoop"><strong>{digest.category}</strong><span>{digest.title}</span></div>
          )) : <p>No related digest cards yet.</p>}
        </section>
        <section className="detailPanel">
          <h2>Next action</h2>
          <p>{projectLoops.find(l => l.priority === "HIGH")?.text || project.summary || "Review status and choose the next concrete action."}</p>
        </section>
      </div>
    </div>
  );
}

export function findProjectBySlug(data: DashboardData, slug: string) {
  return data.projects.find(project => slugify(project.name) === slug);
}
