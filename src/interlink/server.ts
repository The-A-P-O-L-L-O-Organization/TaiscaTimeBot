import http from "http";
import crypto from "crypto";

interface InterlinkEnvelope {
  protocol: string;
  version: string;
  type: string;
  source: string;
  target: string;
  id: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

interface OverrideModule {
  forceOverride: (userId: string) => boolean;
  deactivate: (userId: string) => boolean;
}

const VALID_TYPES = new Set(["ping", "pong", "command", "event", "custom"]);

function sendJson(res: http.ServerResponse, status: number, data: Record<string, unknown>): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function createPong(envelope: InterlinkEnvelope): InterlinkEnvelope {
  return {
    protocol: "interlink",
    version: "1",
    type: "pong",
    source: "taisca-time-bot",
    target: envelope.source,
    id: envelope.id || crypto.randomUUID(),
    timestamp: Date.now(),
    payload: { status: "ok", uptime: process.uptime() },
  };
}

function handleEnvelope(
  envelope: InterlinkEnvelope,
  deps: { override: OverrideModule },
): { status: number; body: Record<string, unknown> } {
  if (!envelope || envelope.protocol !== "interlink") {
    return { status: 400, body: { error: "Invalid interlink envelope" } };
  }

  if (envelope.type === "ping") {
    return { status: 200, body: createPong(envelope) as unknown as Record<string, unknown> };
  }

  if (envelope.type === "command") {
    const cmd = (envelope.payload as Record<string, unknown>)?.command as string | undefined;
    if (cmd === "override") {
      const action = (envelope.payload as Record<string, unknown>)?.action as string | undefined;
      const userId = (envelope.payload as Record<string, unknown>)?.userId as string | undefined;
      if (action === "activate" && userId) {
        const ok = deps.override.forceOverride(userId);
        return {
          status: 200,
          body: { status: ok ? "ok" : "error", message: ok ? "Override activated" : "Failed to activate override" },
        };
      }
      if (action === "deactivate" && userId) {
        const ok = deps.override.deactivate(userId);
        return {
          status: 200,
          body: { status: ok ? "ok" : "error", message: ok ? "Override deactivated" : "Override was not active" },
        };
      }
      return { status: 400, body: { error: "Invalid override command. Requires action and userId." } };
    }
    return { status: 400, body: { error: `Unknown command: ${cmd}` } };
  }

  return { status: 200, body: { status: "accepted", id: envelope.id } };
}

export function createInterlinkServer(deps: { override: OverrideModule; apiKey: string }): http.Server {
  const { apiKey } = deps;
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Bearer ") || auth.slice(7) !== apiKey) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    let body = "";
    try {
      for await (const chunk of req) {
        body += chunk;
      }
    } catch {
      sendJson(res, 400, { error: "Failed to read request body" });
      return;
    }

    let envelope: InterlinkEnvelope;
    try {
      envelope = JSON.parse(body);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON" });
      return;
    }

    const result = handleEnvelope(envelope, deps);
    sendJson(res, result.status, result.body);
  });

  return server;
}
