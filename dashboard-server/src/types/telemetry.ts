export interface ThreatAlertPayload {
  timestamp: string;
  session_id: string;
  diri_score: number;
  status: "CRITICAL_THREAT" | "WARNING" | "NORMAL";
  model_confidence: number;
}
