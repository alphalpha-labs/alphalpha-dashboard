import { attentionQueue, digests, generatedAt, investingCandidates, metrics, openLoops, projects } from "@/lib/data";

const toneClass: Record<string, string> = {
  red: "toneRed",
  amber: "toneAmber",
  blue: "toneBlue",
  purple: "tonePurple",
  green: "toneGreen",
};

function Pill({ children, tone = "blue" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill ${toneClass[tone] ?? toneClass.blue}`}>{children}</span>;
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="sectionHeader">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  return (
    <main>
      <header className="hero">
        <nav className="nav">
          <div className="brandMark">α</div>
          <div className="navLinks">
            <a href="#projects">Projects</a>
            <a href="#loops">Open loops</a>
            <a href="#investing">Investing</a>
            <a href="#digests">Digests</a>
          </div>
        </nav>
        <div className="heroGrid">
          <div>
            <p className="kicker">Alphalpha Chief-of-Staff OS</p>
            <h1>One calm surface for what needs attention, what changed, and what to do next.</h1>
            <p className="lede">
              A Vercel-ready command center for open loops, project state, investing research candidates, and synthesis trails.
            </p>
          </div>
          <aside className="briefCard">
            <p className="briefLabel">Today&apos;s operating posture</p>
            <h3>Build the dashboard, then connect live sources.</h3>
            <p>Phase 1 is intentionally file-backed and readable. Phase 2 can pull Obsidian, GitHub, cron, and Thesis Baskets data directly.</p>
            <div className="briefMeta">Generated {new Date(generatedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</div>
          </aside>
        </div>
      </header>

      <section className="metrics" aria-label="Status metrics">
        {metrics.map((metric) => (
          <article className="metricCard" key={metric.label}>
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span className={toneClass[metric.tone]}>{metric.detail}</span>
          </article>
        ))}
      </section>

      <div className="dashboardGrid">
        <Section eyebrow="Attention queue" title="What needs a decision or action">
          <div className="stack">
            {attentionQueue.map((item) => (
              <article className="attentionCard" key={item.title}>
                <div className="cardTopline">
                  <Pill tone={item.priority === "urgent" ? "red" : item.priority === "high" ? "amber" : "blue"}>{item.priority}</Pill>
                  <span>{item.age} · {item.confidence} confidence</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.reason}</p>
                <div className="nextAction">Next: {item.action}</div>
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="Commitments" title="Open loops">
          <div className="loopList" id="loops">
            {openLoops.map((loop) => (
              <div className="loopRow" key={loop.item}>
                <div>
                  <strong>{loop.item}</strong>
                  <span>{loop.owner} · due {loop.due}</span>
                </div>
                <Pill tone={loop.priority === "urgent" ? "red" : loop.priority === "high" ? "amber" : "blue"}>{loop.priority}</Pill>
                <p>{loop.next}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section eyebrow="Portfolio of work" title="Active projects">
        <div className="projectGrid" id="projects">
          {projects.map((project) => (
            <article className="projectCard" key={project.name}>
              <div className="cardTopline">
                <Pill tone={project.status === "blocked" ? "red" : project.status === "waiting" ? "amber" : "green"}>{project.status}</Pill>
                <span>{project.domain}</span>
              </div>
              <h3>{project.name}</h3>
              <p className="muted">Last activity: {project.lastActivity}</p>
              <p>{project.nextAction}</p>
              {project.blocker ? <div className="blocker">Blocked by: {project.blocker}</div> : <div className="source">Source: {project.source}</div>}
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="Research queue" title="Investing candidates to remember">
        <div className="tableWrap" id="investing">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Theme</th>
                <th>Stance</th>
                <th>Entry / research trigger</th>
                <th>Contradiction to watch</th>
              </tr>
            </thead>
            <tbody>
              {investingCandidates.map((candidate) => (
                <tr key={candidate.ticker}>
                  <td><strong>{candidate.ticker}</strong><span>{candidate.confidence} confidence</span></td>
                  <td>{candidate.theme}</td>
                  <td>{candidate.stance}</td>
                  <td>{candidate.trigger}</td>
                  <td>{candidate.contradiction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section eyebrow="Source trail" title="Latest syntheses and digests">
        <div className="digestGrid" id="digests">
          {digests.map((digest) => (
            <article className="digestCard" key={digest.title}>
              <div className="cardTopline"><span>{digest.date}</span><span>{digest.source}</span></div>
              <h3>{digest.title}</h3>
              <p>{digest.summary}</p>
              <div className="tagRow">{digest.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
            </article>
          ))}
        </div>
      </Section>
    </main>
  );
}
