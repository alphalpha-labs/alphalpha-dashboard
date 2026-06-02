const DEFAULT_OUTING_ORACLE_URL = "https://outing-oracle.vercel.app";

export default function OutingOracleTab() {
  const url = process.env.NEXT_PUBLIC_OUTING_ORACLE_URL || DEFAULT_OUTING_ORACLE_URL;

  return (
    <div className="outingOraclePage">
      <div className="outingOracleHeader">
        <div>
          <h1 className="tabTitle">Outing Oracle</h1>
          <p className="tabSubtitle">
            Family outing recommender prototype, embedded from the standalone app.
          </p>
        </div>
        <a className="btnDone outingOracleLaunch" href={url} target="_blank" rel="noreferrer">
          Open app
        </a>
      </div>
      <div className="outingOracleFrameShell">
        <iframe
          className="outingOracleFrame"
          src={url}
          title="Outing Oracle"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
