import {
  Activity,
  AudioLines,
  Headphones,
  Radio,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AlertBanner } from "./components/AlertBanner";
import { AuditTable } from "./components/AuditTable";
import { AuthenticityMeter } from "./components/AuthenticityMeter";
import { LiveWaveform } from "./components/LiveWaveform";
import { useAlertSocket } from "./hooks/useAlertSocket";
import { useAudioStream } from "./hooks/useAudioStream";
import { fetchAuditLogs, fetchLiveMetrics } from "./services/api";
import type { AuditLogItem, LiveMetrics } from "./types";

const INITIAL_METRICS: LiveMetrics = {
  total_sessions_evaluated: 0,
  average_diri_score: 0,
  total_threat_incidents: 0,
};

export default function App(): JSX.Element {
  const stream = useAudioStream();
  const alertSocket = useAlertSocket();
  const alerts = alertSocket.alerts;
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [metrics, setMetrics] = useState<LiveMetrics>(INITIAL_METRICS);
  const [auditLoading, setAuditLoading] = useState<boolean>(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [metricsAvailable, setMetricsAvailable] = useState<boolean>(false);
  const activeCriticalAlert =
    alerts.find((alert) => alert.status === "CRITICAL_THREAT") ?? null;
  const diriScore =
    stream.lastResult?.diri_score ?? activeCriticalAlert?.diri_score ?? 0;
  const systemOperational = metricsAvailable && alertSocket.isConnected;

  const refreshDashboard = useCallback(async (): Promise<void> => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const [auditResult, metricsResult] = await Promise.allSettled([
        fetchAuditLogs(1, 25),
        fetchLiveMetrics(),
      ]);
      if (auditResult.status === "fulfilled") {
        setLogs(auditResult.value.data);
      } else {
        setAuditError("Could not load audit events. Check the audit server.");
      }
      if (metricsResult.status === "fulfilled") {
        setMetrics(metricsResult.value);
        setMetricsAvailable(true);
      } else {
        setMetricsAvailable(false);
      }
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
    const interval = window.setInterval(() => {
      void refreshDashboard();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [refreshDashboard]);

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="VoxGuard dashboard home">
          <span className="brand-mark">
            <Shield size={22} />
            <span />
          </span>
          <span className="brand-name">
            VOX<span>GUARD</span>
            <small>VOICE INTEGRITY PLATFORM</small>
          </span>
        </a>
        <div className="topbar-right">
          <div className="system-health">
            <span className="health-dot" />
            SYSTEM {systemOperational ? "OPERATIONAL" : "DEGRADED"}
          </div>
          <span className="topbar-divider" />
          <span className="operator-label">
            <span className="operator-avatar">VG</span>
            SECURITY OPS
          </span>
        </div>
      </header>

      <div className="dashboard-content">
        <section className="page-intro">
          <div>
            <p className="eyebrow">THREAT MONITORING / OVERVIEW</p>
            <h1>Security control room</h1>
            <p className="page-subtitle">
              Real-time voice authenticity analysis and impersonation defense.
            </p>
          </div>
          <div className="connection-status">
            <span className={`connection-pip ${stream.isStreaming ? "active" : ""}`} />
            {stream.isStreaming ? "CAPTURE ACTIVE" : "CAPTURE STANDBY"}
          </div>
        </section>

        <AlertBanner diriScore={diriScore} activeAlert={activeCriticalAlert} />

        <section className="metrics-grid" aria-label="Live security metrics">
          <article className="metric-card">
            <span className="metric-icon turquoise">
              <Users size={18} />
            </span>
            <div>
              <span className="metric-label">SESSIONS EVALUATED</span>
              <strong>{metrics.total_sessions_evaluated.toLocaleString()}</strong>
            </div>
            <span className="metric-footnote">All time</span>
          </article>
          <article className="metric-card">
            <span className="metric-icon blue">
              <Activity size={18} />
            </span>
            <div>
              <span className="metric-label">AVERAGE DIRI</span>
              <strong>{metrics.average_diri_score.toFixed(1)}%</strong>
            </div>
            <span className="metric-footnote">Across evaluations</span>
          </article>
          <article className="metric-card">
            <span className="metric-icon red">
              <ShieldAlert size={18} />
            </span>
            <div>
              <span className="metric-label">THREAT INCIDENTS</span>
              <strong>{metrics.total_threat_incidents.toLocaleString()}</strong>
            </div>
            <span className="metric-footnote">Critical detections</span>
          </article>
          <article className="metric-card service-card">
            <span className="metric-icon violet">
              <Radio size={18} />
            </span>
            <div>
              <span className="metric-label">MODEL SERVICE</span>
              <strong>{metricsAvailable ? "READY" : "OFFLINE"}</strong>
            </div>
            <span className="service-pip" />
          </article>
        </section>

        <section className="monitor-grid">
          <LiveWaveform
            samples={stream.waveformData}
            isActive={stream.isStreaming}
          />
          <AuthenticityMeter score={diriScore} />
        </section>

        <section className="stream-control panel">
          <div className="stream-copy">
            <span className={`mic-icon ${stream.isStreaming ? "active" : ""}`}>
              <Headphones size={19} />
            </span>
            <div>
              <h2>Live audio analysis</h2>
              <p>
                {stream.isStreaming
                  ? `Secure stream active · ${stream.sessionId.slice(0, 18)}`
                  : "Capture is opt-in. Audio is analyzed in volatile memory only."}
              </p>
            </div>
          </div>
          <button
            className={`stream-button ${stream.isStreaming ? "stop" : ""}`}
            type="button"
            onClick={() => {
              if (stream.isStreaming) {
                stream.stopStream();
              } else {
                void stream.startStream();
              }
            }}
            disabled={stream.status === "connecting"}
          >
            <AudioLines size={17} />
            {stream.status === "connecting"
              ? "CONNECTING…"
              : stream.isStreaming
                ? "STOP ANALYSIS"
                : "START ANALYSIS"}
          </button>
        </section>
        {stream.error ? (
          <p className="stream-error" role="alert">
            {stream.error}
          </p>
        ) : null}

        <AuditTable
          logs={logs}
          isLoading={auditLoading}
          error={auditError}
          onRefresh={() => void refreshDashboard()}
        />
        <footer className="dashboard-footer">
          <span>VOXGUARD CORE ENGINE</span>
          <span>PCM AUDIO · ZERO-DISK RETENTION · 500 MS WINDOW</span>
          <span>
            LIVE ALERTS {alertSocket.isConnected ? `· ${alerts.length}` : "· OFFLINE"}
          </span>
        </footer>
      </div>
    </main>
  );
}
