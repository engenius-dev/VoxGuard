import type { NextFunction, Request, Response } from "express";

import { AuditLog } from "../models/AuditLog.js";

interface LiveMetricsAggregation {
  sessions: string[];
  average_diri_score: number | null;
  total_threat_incidents: number;
}

export async function getLiveMetrics(
  _request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const [metrics] = await AuditLog.aggregate<LiveMetricsAggregation>([
      {
        $group: {
          _id: null,
          sessions: { $addToSet: "$session_id" },
          average_diri_score: { $avg: "$diri_score" },
          total_threat_incidents: {
            $sum: {
              $cond: [{ $eq: ["$status", "CRITICAL_THREAT"] }, 1, 0],
            },
          },
        },
      },
    ]).exec();

    response.json({
      total_sessions_evaluated: metrics?.sessions.length ?? 0,
      average_diri_score: metrics?.average_diri_score ?? 0,
      total_threat_incidents: metrics?.total_threat_incidents ?? 0,
    });
  } catch (error: unknown) {
    next(error);
  }
}
