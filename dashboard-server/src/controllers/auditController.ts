import type { NextFunction, Request, Response } from "express";

import { AuditLog } from "../models/AuditLog.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export async function getAuditLogs(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = parsePositiveInteger(request.query.page, DEFAULT_PAGE);
    const limit = Math.min(
      parsePositiveInteger(request.query.limit, DEFAULT_LIMIT),
      MAX_LIMIT,
    );
    const [logs, total] = await Promise.all([
      AuditLog.find()
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      AuditLog.countDocuments().exec(),
    ]);

    response.json({
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    next(error);
  }
}

export async function getSessionAudit(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const logs = await AuditLog.find({ session_id: request.params.id })
      .sort({ timestamp: -1 })
      .lean()
      .exec();
    response.json({ data: logs });
  } catch (error: unknown) {
    next(error);
  }
}
