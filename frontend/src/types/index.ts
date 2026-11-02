export interface DIRIScore {
  session_id: string;
  diri_score: number;
  raw_score: number;
  status?: "processed";
}

export interface ThreatAlert {
  timestamp: string;
  session_id: string;
  diri_score: number;
  status: "CRITICAL_THREAT" | "WARNING" | "NORMAL";
  model_confidence: number;
}

export interface AuditLogItem extends ThreatAlert {
  _id: string;
}

export interface LiveMetrics {
  total_sessions_evaluated: number;
  average_diri_score: number;
  total_threat_incidents: number;
}

export type AudioStreamStatus = "idle" | "connecting" | "streaming" | "error";
