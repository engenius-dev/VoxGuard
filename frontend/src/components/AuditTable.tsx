import { Clock3, RefreshCw } from "lucide-react";

import type { AuditLogItem } from "../types";

interface AuditTableProps {
  logs: AuditLogItem[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

export function AuditTable({
  logs,
  isLoading,
  error,
  onRefresh,
}: AuditTableProps): JSX.Element {
  return (
    <section className="panel audit-panel">
      <div className="panel-heading audit-heading">
        <div>
          <p className="eyebrow">Forensic trail</p>
          <h2>Recent audit events</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh audit events"
        >
          <RefreshCw size={16} className={isLoading ? "spin" : ""} />
        </button>
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Session</th>
              <th>Time</th>
              <th>DIRI</th>
              <th>Confidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id}>
                <td className="session-cell" title={log.session_id}>
                  {log.session_id.slice(0, 16)}
                </td>
                <td className="time-cell">
                  <Clock3 size={13} />
                  {formatTimestamp(log.timestamp)}
                </td>
                <td>{log.diri_score.toFixed(1)}%</td>
                <td>{(log.model_confidence * 100).toFixed(1)}%</td>
                <td>
                  <span
                    className={`table-status ${log.status.toLowerCase()}`}
                  >
                    {log.status.replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
            {!isLoading && logs.length === 0 ? (
              <tr>
                <td className="empty-row" colSpan={5}>
                  No audit events have been recorded.
                </td>
              </tr>
            ) : null}
            {isLoading && logs.length === 0 ? (
              <tr>
                <td className="empty-row" colSpan={5}>
                  Loading audit events…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
