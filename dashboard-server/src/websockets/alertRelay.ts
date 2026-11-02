import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

import type { ThreatAlertPayload } from "../types/telemetry.js";

export interface AlertRelay {
  broadcastAlert(alert: ThreatAlertPayload): void;
  close(): Promise<void>;
}

export function createAlertRelay(server: HttpServer): AlertRelay {
  const webSocketServer = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  webSocketServer.on("connection", (client: WebSocket): void => {
    clients.add(client);
    client.on("close", (): void => {
      clients.delete(client);
    });
    client.on("error", (error: Error): void => {
      console.error("WebSocket client error:", error.message);
      clients.delete(client);
    });
  });

  return {
    broadcastAlert(alert: ThreatAlertPayload): void {
      const message = JSON.stringify(alert);
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message, (error?: Error): void => {
            if (error) {
              console.error("WebSocket alert delivery failed:", error.message);
              clients.delete(client);
            }
          });
        }
      }
    },
    close(): Promise<void> {
      for (const client of clients) {
        client.close();
      }
      clients.clear();
      return new Promise((resolve, reject): void => {
        webSocketServer.close((error?: Error): void => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
