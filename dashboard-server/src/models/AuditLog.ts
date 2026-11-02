import { model, Schema } from "mongoose";

import type { ThreatAlertPayload } from "../types/telemetry.js";

const auditLogSchema = new Schema<ThreatAlertPayload>(
  {
    timestamp: { type: String, required: true },
    session_id: { type: String, required: true, index: true },
    diri_score: { type: Number, required: true, min: 0, max: 100, index: true },
    status: {
      type: String,
      required: true,
      enum: ["CRITICAL_THREAT", "WARNING", "NORMAL"],
      index: true,
    },
    model_confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      index: true,
    },
  },
  { versionKey: false },
);

export const AuditLog = model<ThreatAlertPayload>("AuditLog", auditLogSchema);
