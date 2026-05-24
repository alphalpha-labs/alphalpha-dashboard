import Link from "next/link";
import type { Project, Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import { slugify } from "@/lib/slugs";

interface Props {
  projects:  Project[];
  loops:     Loop[];
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function ProjectGrid({ projects, loops, onDiscuss }: Props) {
  return (
    <div className="tabPageWide">
      <h1 className="tabTitle">Projects</h1>
      <p className="tabSubtitle">{projects.length} active workstreams</p>
      <p className="projectLegend">
        <span className="alphaGlyph">α</span> = OpenClaw managed &nbsp;·&nbsp; manually tracked = you own it
      </p>
      <div className="projectGrid">
        {projects.map(project => {
          const projLoops = loops.filter(l => l.project === project.name && !l.done && !l.snoozed);
          const highPri   = projLoops.filter(l => l.priority === "HIGH").length;
          const inlineLoops = (project.loops?.length ? project.loops : projLoops).slice(0, 2);
          return (
            <article key={project.id} className="projectCard">
              <div className="projectCardTop">
                <span className="projectCategory">{project.category}</span>
                <div className="projectBadges">
                  {project.ocOwned && (
                    <span className="badgeOC">
                      <span className="alphaGlyph">α</span> OpenClaw
                    </span>
                  )}
                  <span className={`badgeStatus badgeStatus--${project.status}`}>{project.status}</span>
                </div>
              </div>
              <h2 className="projectName">{project.name}</h2>
              <p className="projectSummary">{project.summary}</p>
              <div className="projectMeta">
                <span>Last: {project.lastActivity}</span>
                {highPri > 0 && (
                  <span className="projectHighPri">
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                    {highPri} urgent
                  </span>
                )}
              </div>
              {inlineLoops.length > 0 && (
                <div className="projectLoops">
                  {inlineLoops.map((loop, i) => (
                    <div key={loop.id ?? i} className="projectLoop">
                      <span className="projectLoopDot" />
                      {loop.text}
                    </div>
                  ))}
                  {projLoops.length > 2 && (
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--accent-link)" }}>
                      +{projLoops.length - 2} more loops
                    </div>
                  )}
                </div>
              )}
              <div className="projectDiscuss">
                <Link className="btnAlphaDiscuss" href={`/projects/${slugify(project.name)}`}>Details</Link>
                <button
                  className="btnAlphaDiscuss"
                  onClick={() => onDiscuss({ id: project.id, type: "project", title: project.name, summary: project.summary, ocOwned: project.ocOwned })}
                >
                  <span className="alphaGlyph">α</span> Discuss
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
