import Fastify, { type FastifyInstance } from "fastify";
import { APIResponse, type HealthResponse } from "@parapetai/parapet/runtime/core/types";
import { registerInvokeRoutes } from "@parapetai/parapet/runtime/http/routes/index";
import { registerAdminConsole } from "@parapetai/parapet/runtime/http/routes/adminConsole";
import { registerAdminData } from "@parapetai/parapet/runtime/http/routes/adminData";
import { registerAdminAuth } from "@parapetai/parapet/runtime/http/routes/adminAuth";

export interface RunningServer {
  readonly server: any;
  readonly port: number;
  close(): Promise<void>;
}

export async function startHttpServer(port: number): Promise<RunningServer> {
  const app: FastifyInstance = Fastify({ logger: false });

  // tolerant JSON parser: treat empty body as {}, and invalid JSON as null so routes can handle
  app.addContentTypeParser(/^application\/json(?:;.*)?$/i, { parseAs: "string" }, (_req, body, done) => {
    const text = typeof body === "string" ? body : String(body ?? "");
    if (text.trim() === "") return done(null, {});
    try {
      const parsed = JSON.parse(text);
      return done(null, parsed);
    } catch {
      // fall through to route validation
      return done(null, null as any);
    }
  });

  app.setErrorHandler((err, _request, reply) => {
    if ((err as any)?.code === "FST_ERR_CTP_INVALID_JSON_BODY") {
      const response: APIResponse = { statusCode: 400, error: "invalid_json" };
      return reply.code(response.statusCode).send(response);
    }
    const response: APIResponse = { statusCode: 500, error: "internal_error" };
    return reply.code(response.statusCode).send(response);
  });

  // Parse urlencoded forms for /console/login
  app.addContentTypeParser(/^application\/x-www-form-urlencoded(?:;.*)?$/i, { parseAs: "string" }, (_req, body, done) => {
    const text = typeof body === "string" ? body : String(body ?? "");
    const out: Record<string, string> = {};
    for (const part of text.split("&")) {
      if (!part) continue;
      const [k, v] = part.split("=");
      const key = decodeURIComponent(k ?? "");
      const val = decodeURIComponent(v ?? "");
      if (key) out[key] = val;
    }
    return done(null, out);
  });

  app.get("/health", async (_request, reply) => {
    const response: APIResponse<HealthResponse> = { statusCode: 200, data: { ok: true } };
    return reply.code(response.statusCode).send(response);
  });

  registerAdminAuth(app);
  registerAdminConsole(app);
  registerAdminData(app);
  registerInvokeRoutes(app);

  await app.listen({ port, host: "0.0.0.0" });
  const address = app.server.address();
  const boundPort = (address && typeof address === "object" ? (address as any).port : port) as number;
  return {
    server: app.server,
    port: boundPort,
    close: () => app.close(),
  };
}
