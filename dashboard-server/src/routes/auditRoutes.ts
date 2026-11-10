import { Router } from "express";
import type { NextFunction, Request, Response } from "express";

import { getAuditLogs, getSessionAudit } from "../controllers/auditController.js";
import { getLiveMetrics } from "../controllers/metricsController.js";
import { AuditLog } from "../models/AuditLog.js";
import type { ThreatAlertPayload } from "../types/telemetry.js";
import type { AlertRelay } from "../websockets/alertRelay.js";

function isThreatAlertPayload(value: unknown): value is ThreatAlertPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.timestamp === "string" &&
    !Number.isNaN(Date.parse(payload.timestamp)) &&
    typeof payload.session_id === "string" &&
    payload.session_id.length > 0 &&
    typeof payload.diri_score === "number" &&
    Number.isFinite(payload.diri_score) &&
    payload.diri_score >= 0 &&
    payload.diri_score <= 100 &&
    (payload.status === "CRITICAL_THREAT" ||
      payload.status === "WARNING" ||
      payload.status === "NORMAL") &&
    typeof payload.model_confidence === "number" &&
    Number.isFinite(payload.model_confidence) &&
    payload.model_confidence >= 0 &&
    payload.model_confidence <= 1
  );
}

export function createAuditRouter(alertRelay: AlertRelay): Router {
  const router = Router();

  router.get("/audits", getAuditLogs);
  router.get("/audits/session/:id", getSessionAudit);
  router.get("/metrics/live", getLiveMetrics);
  router.post(
    "/alerts",
    async (
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> => {
      if (!isThreatAlertPayload(request.body)) {
        response.status(400).json({ error: "Invalid threat alert payload" });
        return;
      }

      try {
        const alert = request.body;
        
        // Use findOneAndUpdate with upsert to prevent database row spamming.
        // It searches by session_id: if it exists, it overwrites the score. 
        // If it doesn't exist, it creates a new document.
        const savedAlert = await AuditLog.findOneAndUpdate(
          { session_id: alert.session_id },
          alert,
          { upsert: true, new: true, runValidators: true }
        );
        
        alertRelay.broadcastAlert(alert);
        response.status(200).json({ data: savedAlert });
      } catch (error: unknown) {
        next(error);
      }
    },
  );

  return router;
}
