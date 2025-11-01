import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as fs from "node:fs";
import * as path from "node:path";
import { getSessionFromRequest } from "@parapetai/parapet/runtime/security/session";

function requireSessionOrRedirect(request: FastifyRequest, reply: FastifyReply): boolean {
  if (getSessionFromRequest(request)) return true;
  reply.code(302).header("Location", "/console/login").send();
  return false;
}

function requireSessionOr401(request: FastifyRequest, reply: FastifyReply): boolean {
  if (getSessionFromRequest(request)) return true;
  reply.code(401).send();
  return false;
}

function htmlShell(): string {
  return [
    "<!doctype html>",
    "<html>",
    "  <head>",
    "    <meta charset=\"utf-8\" />",
    "    <meta http-equiv=\"X-Content-Type-Options\" content=\"nosniff\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "    <link rel=\"stylesheet\" href=\"/console/static/app.css\" />",
    "    <title>Parapet Console</title>",
    "  </head>",
    "  <body class=\"bg-slate-900 text-slate-100\">",
    "    <div id=\"root\"></div>",
    "    <script type=\"module\" src=\"/console/static/app.js\"></script>",
    "  </body>",
    "</html>",
  ].join("\n");
}

export function registerAdminConsole(app: FastifyInstance): void {
  app.get("/console", async (request, reply) => {
    if (!requireSessionOrRedirect(request, reply)) return;
    reply.header("Content-Type", "text/html; charset=utf-8").header("Cache-Control", "no-store").send(htmlShell());
  });

  app.get<{ Params: { file: string } }>("/console/static/:file", async (request, reply) => {
    if (!requireSessionOr401(request, reply)) return;
    const file = (request.params as any).file as string;
    const allowed = new Set(["app.js", "app.css"]);
    if (!allowed.has(file)) {
      reply.code(404).send();
      return;
    }
    const fullPath = path.join("/app/console-static", file);
    try {
      const buf = fs.readFileSync(fullPath);
      const ct = file.endsWith(".css") ? "text/css" : "text/javascript";
      reply.header("Content-Type", ct).header("Cache-Control", "no-store").send(buf);
    } catch {
      reply.code(404).send();
    }
  });

  app.get<{ Params: { file: string } }>("/console/static/assets/:file", async (request, reply) => {
    if (!requireSessionOr401(request, reply)) return;
    const file = (request.params as any).file as string;
    if (!/^[A-Za-z0-9_.-]+\.js$/.test(file)) {
      reply.code(404).send();
      return;
    }
    const fullPath = path.join("/app/console-static/assets", file);
    try {
      const buf = fs.readFileSync(fullPath);
      reply.header("Content-Type", "text/javascript").header("Cache-Control", "no-store").send(buf);
    } catch {
      reply.code(404).send();
    }
  });
}


