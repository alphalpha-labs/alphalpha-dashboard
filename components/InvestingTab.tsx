import type { Ticker } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

interface Props {
  investing: Ticker[];
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function InvestingTab({ investing, onDiscuss }: Props) {
  return (
    <div className="investingPage">
      <h1 className="tabTitle">Investing candidates</h1>
      <p className="tabSubtitle">Research queue · {investing.length} tickers · hover to discuss</p>
      {investing.map(t => (
        <div key={t.ticker} className="tickerRow">
          <span className="tickerSymbol">{t.ticker}</span>
          <span className="tickerTheme">{t.theme}</span>
          <span className="tickerStance">{t.stance}</span>
          <span className={`tickerConf tickerConf--${t.confidence}`}>{t.confidence}</span>
          <span className="tickerDiscuss">
            <button
              className="btnAlphaDiscuss"
              onClick={() => onDiscuss({ id: t.ticker, type: "ticker", title: t.ticker, theme: t.theme, stance: t.stance })}
            >
              <span className="alphaGlyph">α</span> Discuss
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
