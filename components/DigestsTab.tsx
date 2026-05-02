import type { Digest } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

interface Props {
  digests:   Digest[];
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function DigestsTab({ digests, onDiscuss }: Props) {
  return (
    <div className="tabPage">
      <h1 className="tabTitle">Digests</h1>
      <p className="tabSubtitle">Syntheses and source trail</p>
      {digests.map(d => (
        <article key={d.id} className="digestItem">
          <div className="digestTop">
            <span className="digestCategory">{d.category}</span>
            <span className="digestDate">{d.date}</span>
          </div>
          <p className="digestTitle">{d.title}</p>
          <p className="digestSummary">{d.summary}</p>
          <div className="digestTags">
            {d.tags.map(tag => <span key={tag} className="digestTag">{tag}</span>)}
          </div>
          <button
            className="btnAlphaDiscuss"
            onClick={() => onDiscuss({ id: d.id, type: "digest", title: d.title, summary: d.summary, category: d.category })}
          >
            <span className="alphaGlyph">α</span> Discuss
          </button>
        </article>
      ))}
    </div>
  );
}
