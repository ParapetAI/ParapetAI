import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { clearSessionCookie, createSession, getSessionFromRequest, setSessionCookie, verifyPassword } from "@parapetai/parapet/runtime/security/session";

function htmlLogin(error?: string): string {
  return [
    "<!doctype html>",
    "<html>",
    "  <head>",
    "    <meta charset=\"utf-8\" />",
    "    <meta http-equiv=\"X-Content-Type-Options\" content=\"nosniff\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "    <title>Parapet Console Login</title>",
    "    <style>body{background:#0f172a;color:#e2e8f0;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;padding:2rem;} .card{max-width:360px;margin:4rem auto;background:#0b1220;border:1px solid #334155;border-radius:8px;padding:1rem 1.25rem;} input{width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:.5rem .6rem;margin:.4rem 0;} button{background:#1e293b;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:.5rem .75rem;cursor:pointer;} .err{color:#fecaca;font-size:.85rem;margin:.5rem 0;}</style>",
    "  </head>",
    "  <body>",
    "    <div class=\"card\">",
    "      <h1 style=\"margin:.25rem 0 1rem;font-size:1.25rem;\">Parapet Console</h1>",
    error ? `      <div class=\"err\">${error}</div>` : "",
    "      <form method=\"POST\" action=\"/console/login\">",
    "        <label>Username</label>",
    "        <input type=\"text\" name=\"username\" autocomplete=\"username\" required />",
    "        <label>Password</label>",
    "        <input type=\"password\" name=\"password\" autocomplete=\"current-password\" required />",
    "        <div style=\"margin-top:.75rem;\"><button type=\"submit\">Log in</button></div>",
    "      </form>",
    "    </div>",
    "  </body>",
    "</html>",
  ].join("\n");
}

export function registerAdminAuth(app: FastifyInstance): void {
  app.get("/console/login", async (_request, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8").header("Cache-Control", "no-store").send(htmlLogin());
  });

  app.post("/console/login", async (request, reply) => {
    const body = request.body as any;
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "").trim();
    if (!username || !password) {
      reply.code(400).header("Content-Type", "text/html; charset=utf-8").send(htmlLogin("Missing credentials"));
      return;
    }
    if (!verifyPassword(username, password)) {
      reply.code(401).header("Content-Type", "text/html; charset=utf-8").send(htmlLogin("Invalid username or password"));
      return;
    }
    const sessionId = createSession(username);
    setSessionCookie(reply, sessionId);
    reply.code(302).header("Location", "/console").send();
  });

  app.post("/console/logout", async (request, reply) => {
    const sess = getSessionFromRequest(request);
    if (sess) {
      // we don't need the session id here to destroy; clearing cookie is sufficient for our use case
    }
    clearSessionCookie(reply);
    reply.code(302).header("Location", "/console/login").send();
  });
}


