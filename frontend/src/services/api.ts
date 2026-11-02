import axios from "axios";

import type { AuditLogItem, LiveMetrics } from "../types";

interface PaginatedAuditResponse {
  data: AuditLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface AuditResponse {
  data: AuditLogItem[];
}

const api = axios.create({
  baseURL: "http://localhost:5000/api/v1",
  timeout: 8000,
  headers: { "Content-Type": "application/json" },
});

export async function fetchAuditLogs(
  page = 1,
  limit = 25,
): Promise<PaginatedAuditResponse> {
  const response = await api.get<PaginatedAuditResponse>("/audits", {
    params: { page, limit },
  });
  return response.data;
}

export async function fetchSessionAudit(
  sessionId: string,
): Promise<AuditLogItem[]> {
  const response = await api.get<AuditResponse>(
    `/audits/session/${encodeURIComponent(sessionId)}`,
  );
  return response.data.data;
}

export async function fetchLiveMetrics(): Promise<LiveMetrics> {
  const response = await api.get<LiveMetrics>("/metrics/live");
  return response.data;
}
