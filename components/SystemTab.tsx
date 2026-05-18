import type { SystemDoc } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

interface Props {
  docs: SystemDoc[];
  onDiscuss: (ctx: ThreadContext) => void;
}

const layerLabels: Record<string, string> = {
  core: "Core",
  context: "Context",
  plan: "Plan",
  private: "Private",
};

export default function SystemTab({ docs, onDiscuss }: Props) {
  const sorted = [...docs].sort((a, b) => {
    const order = ["core", "context", "plan", "private"];
    return order.indexOf(a.layer) - order.indexOf(b.layer) || a.title.localeCompare(b.title);
  });
  const tracked = docs.filter(doc => doc.layer === "plan" || doc.path.includes("OPEN_LOOPS")).length;
  const privateCount = docs.filter(doc => doc.sensitivity === "private").length;
  const totalWords = docs.reduce((sum, doc) => sum + (doc.words || 0), 0);

  return (
    <div className="systemPage">
      <section className="systemHero">
        <div>
          <p className="eyebrow">Alphalpha source surfaces</p>
          <h1 className="tabTitle">System docs</h1>
          <p className="tabSubtitle">
            The core documents that define Alphalpha, the operating model, open loops, and the high-leverage roadmap.
          </p>
        </div>
        <div className="systemStats" aria-label="System document stats">
          <span><strong>{docs.length}</strong> docs</span>
          <span><strong>{totalWords.toLocaleString()}</strong> words</span>
          <span><strong>{privateCount}</strong> private-scoped</span>
          <span><strong>{tracked}</strong> trackers</span>
        </div>
      </section>

      <div className="systemGrid">
        {sorted.map(doc => (
          <article key={doc.id} className={`systemDoc systemDoc--${doc.sensitivity}`}>
            <div className="systemDocTop">
              <span className="systemLayer">{layerLabels[doc.layer] || doc.layer}</span>
              <span className={`systemSensitivity systemSensitivity--${doc.sensitivity}`}>{doc.sensitivity}</span>
            </div>
            <h2>{doc.title}</h2>
            <p className="systemPath">{doc.path}</p>
            <p className="systemSummary">{doc.summary}</p>
            <details className="systemDetails">
              <summary>{doc.content ? "Read full source" : "Read safe excerpt"}</summary>
              <pre>{doc.content || doc.excerpt}</pre>
            </details>
            <div className="systemFooter">
              <div className="digestTags">
                {doc.tags.map(tag => <span key={tag} className="digestTag">{tag}</span>)}
              </div>
              <div className="systemMeta">
                <span>{doc.words.toLocaleString()} words</span>
                {doc.mtime && <span>{doc.mtime.slice(0, 10)}</span>}
              </div>
            </div>
            <button
              className="btnAlphaDiscuss"
              onClick={() => onDiscuss({ id: doc.id, type: "systemDoc", title: doc.title, summary: doc.summary, category: doc.path })}
            >
              <span className="alphaGlyph">α</span> Discuss
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
