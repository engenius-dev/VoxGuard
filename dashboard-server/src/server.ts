import "dotenv/config";

import cors from "cors";
import express from "express";
import { createServer } from "node:http";

import { connectDB } from "./config/db.js";
import { createAuditRouter } from "./routes/auditRoutes.js";
import { createAlertRelay } from "./websockets/alertRelay.js";

const PORT = Number(process.env.PORT ?? 5000);
const app = express();
const httpServer = createServer(app);
const alertRelay = createAlertRelay(httpServer);

app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use("/api/v1", createAuditRouter(alertRelay));
app.get("/health", (_request, response): void => {
  response.json({ status: "online", service: "VoxGuard Audit Server" });
});
app.use(
  (
    error: Error,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ): void => {
    console.error("Dashboard server request failed:", error.message);
    response.status(500).json({ error: "Internal server error" });
  },
);

async function startServer(): Promise<void> {
  await connectDB();
  await new Promise<void>((resolve, reject): void => {
    httpServer.once("error", reject);
    httpServer.listen(PORT, (): void => {
      httpServer.off("error", reject);
      resolve();
    });
  });
  console.info(`VoxGuard Audit Server listening on port ${PORT}`);
}

async function shutdown(): Promise<void> {
  await alertRelay.close();
  await new Promise<void>((resolve, reject): void => {
    httpServer.close((error?: Error): void => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  await import("mongoose").then(({ default: mongoose }) => mongoose.disconnect());
}

process.once("SIGINT", (): void => {
  void shutdown().catch((error: unknown) => {
    console.error("Graceful shutdown failed:", error);
    process.exitCode = 1;
  });
});
process.once("SIGTERM", (): void => {
  void shutdown().catch((error: unknown) => {
    console.error("Graceful shutdown failed:", error);
    process.exitCode = 1;
  });
});

void startServer().catch((error: unknown) => {
  console.error("Failed to start VoxGuard Audit Server:", error);
  process.exitCode = 1;
});
