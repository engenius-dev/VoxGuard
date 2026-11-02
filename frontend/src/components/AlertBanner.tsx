import { AlertTriangle } from "lucide-react";

import type { ThreatAlert } from "../types";

interface AlertBannerProps {
  diriScore: number;
  activeAlert: ThreatAlert | null;
}

export function AlertBanner({
  diriScore,
  activeAlert,
}: AlertBannerProps): JSX.Element | null {
  const threatActive = diriScore >= 75 || activeAlert?.status === "CRITICAL_THREAT";
  if (!threatActive) {
    return null;
  }

  return (
    <section
      className="alert-banner"
      role="alert"
      aria-live="assertive"
    >
      <span className="alert-icon">
        <AlertTriangle size={21} />
      </span>
      <div className="alert-copy">
        <strong>CRITICAL_THREAT · ACTIVE</strong>
        <span>
          Voice authenticity anomaly exceeds the 75% risk threshold
          {activeAlert ? ` · session ${activeAlert.session_id.slice(0, 12)}` : ""}
        </span>
      </div>
      <span className="alert-score">{Math.round(diriScore)}% DIRI</span>
    </section>
  );
}
