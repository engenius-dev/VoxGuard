import { useEffect, useState } from "react";

import type { ThreatAlert } from "../types";

interface UseAlertSocketResult {
  alerts: ThreatAlert[];
  isConnected: boolean;
}

function parseThreatAlert(value: unknown): ThreatAlert | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const alert = value as Record<string, unknown>;
  if (
    typeof alert.timestamp !== "string" ||
    typeof alert.session_id !== "string" ||
    typeof alert.diri_score !== "number" ||
    typeof alert.model_confidence !== "number" ||
    (alert.status !== "CRITICAL_THREAT" &&
      alert.status !== "WARNING" &&
      alert.status !== "NORMAL")
  ) {
    return null;
  }
  return {
    timestamp: alert.timestamp,
    session_id: alert.session_id,
    diri_score: alert.diri_score,
    model_confidence: alert.model_confidence,
    status: alert.status,
  };
}

export function useAlertSocket(): UseAlertSocketResult {
  const [alerts, setAlerts] = useState<ThreatAlert[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimeout: number | null = null;

    const connect = (): void => {
      if (disposed) {
        return;
      }
      const currentSocket = new WebSocket("ws://localhost:5000");
      socket = currentSocket;
      currentSocket.addEventListener("open", () => {
        if (!disposed) {
          setIsConnected(true);
        }
      });
      currentSocket.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (disposed) {
          return;
        }
        if (typeof event.data !== "string") {
          return;
        }
        try {
          const alert = parseThreatAlert(JSON.parse(event.data) as unknown);
          if (alert) {
            setAlerts((currentAlerts) => [alert, ...currentAlerts].slice(0, 10));
          }
        } catch {
          console.error("Received invalid alert data from the audit server.");
        }
      });
      currentSocket.addEventListener("close", () => {
        if (!disposed) {
          setIsConnected(false);
          retryTimeout = window.setTimeout(connect, 3000);
        }
      });
      currentSocket.addEventListener("error", () => {
        currentSocket.close();
      });
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout);
      }
      socket?.close(1000, "Dashboard closed");
    };
  }, []);

  return { alerts, isConnected };
}
