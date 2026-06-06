"use client";

import { useEffect, useState } from "react";

export default function AppBootOverlay() {
  const [mounted, setMounted] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const minVisibleMs = 650;
    const startedAt = performance.now();

    const finish = () => {
      const remaining = Math.max(0, minVisibleMs - (performance.now() - startedAt));
      window.setTimeout(() => {
        setExiting(true);
        window.setTimeout(() => setMounted(false), 260);
      }, remaining);
    };

    if (document.readyState === "complete") {
      finish();
      return;
    }

    window.addEventListener("load", finish, { once: true });
    return () => window.removeEventListener("load", finish);
  }, []);

  if (!mounted) return null;

  return (
    <div className={`appBoot${exiting ? " appBoot--exit" : ""}`} role="status" aria-live="polite" aria-label="Loading Alphalpha">
      <div className="appBoot__panel">
        <div className="appBoot__mark" aria-hidden="true">
          <span>α</span>
          <i />
        </div>
        <div className="appBoot__copy">
          <strong>Alphalpha</strong>
          <span>Assembling the day</span>
        </div>
        <div className="appBoot__trace" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
