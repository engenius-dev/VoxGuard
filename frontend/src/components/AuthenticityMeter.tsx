import { ShieldCheck } from "lucide-react";

interface AuthenticityMeterProps {
  score: number;
}

function getScorePresentation(score: number): {
  color: string;
  label: string;
  className: string;
} {
  if (score >= 75) {
    return { color: "#fb5368", label: "Critical risk", className: "critical" };
  }
  if (score >= 40) {
    return { color: "#f3bd55", label: "Elevated risk", className: "elevated" };
  }
  return { color: "#38d6a5", label: "Authentic", className: "authentic" };
}

export function AuthenticityMeter({
  score,
}: AuthenticityMeterProps): JSX.Element {
  const normalizedScore = Math.min(100, Math.max(0, score));
  const presentation = getScorePresentation(normalizedScore);
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalizedScore / 100);

  return (
    <section
      className={`panel meter-panel ${presentation.className}`}
      aria-label="Dynamic Impersonation Risk Index"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Voice integrity</p>
          <h2>Authenticity</h2>
        </div>
        <span className="icon-chip">
          <ShieldCheck size={18} />
        </span>
      </div>
      <div className="meter-wrap">
        <svg
          className="meter-svg"
          viewBox="0 0 180 180"
          role="img"
          aria-label={`DIRI ${Math.round(normalizedScore)} percent`}
        >
          <circle className="meter-track" cx="90" cy="90" r={radius} />
          <circle
            className="meter-progress"
            cx="90"
            cy="90"
            r={radius}
            style={{
              stroke: presentation.color,
              strokeDasharray: circumference,
              strokeDashoffset: dashOffset,
            }}
          />
        </svg>
        <div className="meter-value">
          <strong>{Math.round(normalizedScore)}</strong>
          <span>%</span>
          <small>DIRI SCORE</small>
        </div>
      </div>
      <div className="meter-status" style={{ color: presentation.color }}>
        <span className="status-dot" />
        {presentation.label}
      </div>
      <p className="panel-caption">
        Dynamic Impersonation Risk Index
      </p>
    </section>
  );
}
